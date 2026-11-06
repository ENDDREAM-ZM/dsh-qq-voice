// dsh-qq-voice —— QQ 语音插件（DSH 插件，OneBot v11）
//
// 文字 → Edge TTS → MP3 → QQ 语音条。
// 9 种话：普通话 / 粤语 / 东北话 / 陕西话 / 山东话 / 台普 / 英语 / 日语 / 韩语。
//
// 零硬编码凭据：解释器路径、音色、语速、音调全部来自设置。
// Edge TTS 需要宿主机器装好 python 包：pip install edge-tts（README 有写）。

import { spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createAdapter } from './onebot.js';

// 只有 IPv4 出口的机器上，undici 可能挑到 AAAA 记录直接 fetch failed
try {
  const { default: dns } = await import('node:dns');
  dns.setDefaultResultOrder('ipv4first');
} catch { /* 老 node 没这个 API */ }
import { registerTool, defineConfig } from './dsh-compat.js';

export const name = 'dsh-qq-voice';
export const inject = ['tools'];

const DIALECT_LABEL = {
  mandarin: '普通话', yue: '粤语', northeast: '东北话', shaanxi: '陕西话',
  shandong: '山东话', taiwan: '台普', en: '英语', ja: '日语', ko: '韩语',
};

const DIALECT_VOICES = {
  mandarin: 'zh-CN-XiaoyiNeural',
  yue: 'zh-HK-HiuMaanNeural',
  northeast: 'zh-CN-liaoning-XiaobeiNeural',
  shaanxi: 'zh-CN-shaanxi-XiaoniNeural',
  shandong: 'zh-CN-liaoning-XiaobeiNeural',
  taiwan: 'zh-TW-HsiaoChenNeural',
  en: 'en-US-AriaNeural',
  ja: 'ja-JP-NanamiNeural',
  ko: 'ko-KR-SunHiNeural',
};

const DIALECT_MARKERS = {
  yue: ['唔', '嘅', '咗', '啲', '冇', '佢', '喺', '嗰', '哋', '乜', '咁', '睇', '諗', '啱', '咩', '攰', '嘢', '講', '係咪', '邊度', '點解', '而家', '鍾意'],
  northeast: ['咋整', '嘎哈', '干哈', '干啥玩意儿', '得瑟', '嘚瑟', '埋汰', '忽悠', '溜达', '铁子', '瘪犊子', '扯犊子', '麻溜', '贼拉', '贼好', '老鼻子', '整明白', '那啥', '哎妈呀', '哎呀妈呀', '稀罕', '咋地', '咋样儿', '够呛', '贼', '瓷实', '熊色', '磕碜', '老铁', '嗯呢', '搁这', '整个', '整点', '咋回事儿', '不赖', '杠杠的'],
  shaanxi: ['嘹咋', '嫽', '咥', '谝', '咋咧', '克里马擦', '扎势', '皮干', '额滴', '么麻达', '额们', '言传', '额是', '额说', '额不', '额跟', '额就', '额这', '咧', '甭', '啥嘛', '一搭', '嘹'],
  taiwan: ['影片', '品質', '資訊', '軟體', '硬體', '網路', '計程車', '馬鈴薯', '捷運', '機車', '立馬', '誒', '喔', '耶', '齁', '欸', '超扯', '夭壽', '便當', '幼稚園', '國小', '國中', '腳踏車', '泡麵', '鳳梨'],
};

const TRADITIONAL = /[們這說講個麼來時會對開關嗎為與學應覺車錢買賣過還進動樣話語請謝讓給從點電頭題實體發經濟該讚喔]/;

const DIALECT_REQUESTS = [
  ['yue', /粤语|粵語|广东话|廣東話|白话|白話|香港话|港腔/],
  ['northeast', /东北话|東北話|东北腔|东北音|东北口音|辽宁话|沈阳话|哈尔滨话/],
  ['shaanxi', /陕西话|陝西話|陕西腔|陕西音|西安话|关中话|陕北话|秦腔/],
  ['shandong', /山东话|山東話|山东腔|山东音|济南话|青岛话|山东口音/],
  ['taiwan', /台普|台湾腔|台灣腔|台湾国语|湾湾腔|台味/],
  ['en', /英语|英文|英語|english/i],
  ['ja', /日语|日文|日本语|日本語|japanese/i],
  ['ko', /韩语|韩文|한국어|korean/i],
  ['mandarin', /普通话|標準話|标准话/],
];

const SAMPLE_LINES = {
  mandarin: ['我在呢，想听我说点什么？', '小鲸鱼在这儿，随时待命。', '这一段是给你单独说的，听见了吗？'],
  yue: ['唔该晒，得闲饮茶。', '你听下我把声，系咪好正？', '今晚记得早啲瞓，唔好捱夜。'],
  northeast: ['干啥呢老铁，我搁这儿呢。', '哎呀妈呀，这声儿听着得劲不？', '别整那些虚的，有啥事儿直说。'],
  shaanxi: ['你咋个嘛，有啥事儿言传。', '额在咧，你说嘛。', '你慢慢说，额听着咧。'],
  taiwan: ['你好啦，好久不见耶。', '这样子的声音可以吗？', '有事跟我说，我都在喔。'],
  shandong: ['俺在这儿呢，你说吧。', '有事儿你言语一声。', '咱慢慢唠，不着急。'],
  en: ['Hey, I am right here. What do you want me to say?', 'This is my voice. Pretty nice, right?'],
  ja: ['もしもし、聞こえてる？', 'これは私の声だよ、どうかな？'],
  ko: ['여보세요, 잘 들리나요?', '이게 제 목소리예요.'],
};

// 兜底免费源：Edge 挂了还能出声（音色不可选）
const FALLBACK_SOURCES = [
  { name: 'baidu', url: (text, lang, spd) => `https://fanyi.baidu.com/gettts?lan=${lang}&text=${encodeURIComponent(text)}&spd=${spd}&source=web` },
  { name: 'youdao', url: (text, lang) => `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=${lang === 'en' ? 'en' : 'zh'}` },
];

export const Config = defineConfig({
  onebotHttpUrl: { type: 'string', default: 'http://127.0.0.1:3000', description: 'OneBot v11 HTTP 接口地址' },
  onebotWsUrl: { type: 'string', default: 'ws://127.0.0.1:3001', description: 'OneBot v11 正向 WebSocket 地址（填了才能主动收 QQ 消息）' },
  onebotToken: { type: 'string', default: '', description: 'OneBot HTTP token' },
  onebotWsToken: { type: 'string', default: '', description: 'OneBot WebSocket token，留空=与 HTTP token 相同（SnowLuma 两者不同）' },
  selfId: { type: 'string', default: '', description: '机器人 QQ 号' },
  edgePython: { type: 'string', default: 'python3', description: '装了 edge-tts 的 python 解释器路径（pip install edge-tts）。留默认就试系统 python3' },
  ttsVoice: { type: 'string', default: DIALECT_VOICES.mandarin, description: '普通话音色（Edge 音色名）' },
  voiceYue: { type: 'string', default: DIALECT_VOICES.yue, description: '粤语音色' },
  voiceNortheast: { type: 'string', default: DIALECT_VOICES.northeast, description: '东北话音色' },
  voiceShaanxi: { type: 'string', default: DIALECT_VOICES.shaanxi, description: '陕西话音色' },
  voiceShandong: { type: 'string', default: DIALECT_VOICES.shandong, description: '山东话音色（Edge 没有山东话，默认借辽宁音色）' },
  voiceTaiwan: { type: 'string', default: DIALECT_VOICES.taiwan, description: '台普音色' },
  voiceEn: { type: 'string', default: DIALECT_VOICES.en, description: '英语音色' },
  voiceJa: { type: 'string', default: DIALECT_VOICES.ja, description: '日语音色' },
  voiceKo: { type: 'string', default: DIALECT_VOICES.ko, description: '韩语音色' },
  speed: { type: 'number', default: 5, description: '语速 1~9（5 = 正常）' },
  pitchHz: { type: 'number', default: 0, description: '音调偏移（Hz，正数更尖、负数更沉；Edge 上限约 +50）' },
  dialectMatch: { type: 'boolean', default: true, description: '按对方说的方言自动换音色' },
  requireAtInGroup: { type: 'boolean', default: true, description: '群里必须 @ 机器人才响应' },
  maxChars: { type: 'number', default: 300, description: '一次最多念多少字（太长会被截断）' },
  fallbackEnabled: { type: 'boolean', default: true, description: 'Edge 合成失败时退回免费 TTS 源（音色不可选）' },
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function normalizeDialect(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v || v === 'auto') return '';
  return Object.prototype.hasOwnProperty.call(DIALECT_VOICES, v) ? v : '';
}

export function detectDialectRequest(raw) {
  const text = String(raw || '');
  if (!text.trim()) return '';
  let best = '';
  let bestAt = -1;
  for (const [name, re] of DIALECT_REQUESTS) {
    const m = re.exec(text);
    if (m && m.index + m[0].length > bestAt) { bestAt = m.index + m[0].length; best = name; }
  }
  return best;
}

export function detectDialect(raw) {
  const text = String(raw || '');
  if (!text.trim()) return 'mandarin';
  const count = (w) => text.split(w).length - 1;
  const score = (list) => list.reduce((n, w) => n + count(w), 0);
  const traditional = TRADITIONAL.test(text);
  const yue = score(DIALECT_MARKERS.yue);
  if (yue >= 2 || (yue >= 1 && traditional)) return 'yue';
  if (score(DIALECT_MARKERS.shaanxi) >= 1) return 'shaanxi';
  if (score(DIALECT_MARKERS.northeast) >= 1) return 'northeast';
  if (score(DIALECT_MARKERS.taiwan) >= 1 || traditional) return 'taiwan';
  if (/[\u3040-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  if (/^[\x00-\x7f\s.,!?'"-]+$/.test(text.trim())) return 'en';
  return 'mandarin';
}

/** 「语音说 X」「念一下 X」「用粤语说 X」「发条东北话语音」 */
export function parseVoiceCommand(text) {
  const s = String(text || '').replace(/^(\s*@[^\s@]{1,24}\s*)+/g, '').replace(/^[\s，,。.：:、]+/, '').trim();
  if (!s) return { hit: false };
  const dia = '粤语|粵語|广东话|东北话|陕西话|山东话|台普|台湾腔|普通话|英语|日语|韩语';
  const m1 = s.match(new RegExp(`^(?:用|拿)?(${dia})(?:话|腔)?(?:说|讲|念|读|喊)(?:一句|两句|一下|一遍)?\\s*[:：,，]?\\s*([\\s\\S]*)$`));
  if (m1) {
    const asked = detectDialectRequest(m1[1]) || '';
    return { hit: true, dialect: asked, text: m1[2].trim() };
  }
  const m2 = s.match(new RegExp(`^(?:发|来|整|给)?(?:一|两)?(?:条|句|段|个)?(?:用)?(${dia})?(?:语音|声音)(?:的)?(?:说|念|讲|读|喊)?\\s*[:：,，]?\\s*([\\s\\S]*)$`));
  if (m2) {
    const asked = m2[1] ? detectDialectRequest(m2[1]) || '' : '';
    return { hit: true, dialect: asked, text: (m2[2] || '').trim() };
  }
  const m3 = s.match(/^(?:语音说|念一下|说一句|讲一句|读一下|念一段|用语音说)\s*[:：,，]?\s*([\s\S]*)$/);
  if (m3) {
    const body = m3[1].trim();
    return { hit: true, dialect: detectDialectRequest(body) || '', text: body };
  }
  return { hit: false };
}

function looksLikeAudio(buf) {
  if (!buf || buf.length < 1000) return false;
  const head = String(buf.slice(0, 4));
  return head.startsWith('ID3') || buf[0] === 0xff || head.startsWith('RIF') || head.startsWith('OggS') || head.startsWith('fLaC');
}

export function apply(ctx, config) {
  const log = (msg) => { try { ctx.logger?.info?.(msg) ?? console.log(`[${name}] ${msg}`); } catch { /* ignore */ } };
  const cfg = () => ({ ...Config.defaults, ...(config || {}) });
  const setting = (k) => cfg()[k];

  const adapter = createAdapter({
    httpUrl: setting('onebotHttpUrl'),
    wsUrl: setting('onebotWsUrl'),
    token: setting('onebotToken'),
    wsToken: setting('onebotWsToken'),
    selfId: setting('selfId'),
    log,
  });

  const voiceOf = (dialect) => String(setting({
    mandarin: 'ttsVoice', yue: 'voiceYue', northeast: 'voiceNortheast', shaanxi: 'voiceShaanxi',
    shandong: 'voiceShandong', taiwan: 'voiceTaiwan', en: 'voiceEn', ja: 'voiceJa', ko: 'voiceKo',
  }[dialect] || 'ttsVoice') || '').trim();

  function edgeTTS(text, dialect) {
    const spd = clamp(Number(setting('speed')) || 5, 1, 9);
    const pct = Math.round((spd - 5) * 10);
    const rate = `${pct >= 0 ? '+' : ''}${pct}%`;
    const hz = clamp(Math.round(Number(setting('pitchHz')) || 0), -100, 100);
    const pitch = `${hz >= 0 ? '+' : ''}${hz}Hz`;
    const voice = voiceOf(dialect) || DIALECT_VOICES.mandarin;
    const out = path.join(os.tmpdir(), `qq-voice-${randomUUID()}.mp3`);
    const py = String(setting('edgePython') || 'python3').trim();
    return new Promise((resolve, reject) => {
      const child = spawn(py, ['-m', 'edge_tts', '--voice', voice, `--rate=${rate}`, `--pitch=${pitch}`, '--text', text, '--write-media', out], { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderrText = '';
      child.stderr.on('data', (chunk) => { stderrText += String(chunk); });
      const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* ignore */ } }, 30000);
      child.on('error', (error) => { clearTimeout(timer); reject(new Error(`起不了 edge-tts（${py}）：${error.message}`)); });
      child.on('close', async (code) => {
        clearTimeout(timer);
        try {
          if (code !== 0) { reject(new Error(`edge-tts 退出码 ${code}：${stderrText.trim().slice(0, 200)}`)); return; }
          const buf = await readFile(out);
          if (!buf.length) { reject(new Error('edge-tts 产出空文件')); return; }
          resolve({ buf, source: `edge:${voice}` });
        } catch (error) { reject(error); } finally { unlink(out).catch(() => {}); }
      });
    });
  }

  async function synthesize(text, dialect) {
    const errors = [];
    try {
      const { buf, source } = await edgeTTS(text, dialect);
      if (looksLikeAudio(buf)) return { buf, source };
      errors.push(`edge: 返回的不是音频（${buf.length} 字节）`);
    } catch (error) {
      errors.push(`edge: ${error?.message || error}`);
      log(`Edge 合成失败：${error?.message || error}`);
    }
    if (!setting('fallbackEnabled')) throw new Error(`语音合成失败：${errors.join('；')}`);
    const lang = /[\u4e00-\u9fa5]/.test(text) ? 'zh' : 'en';
    for (const src of FALLBACK_SOURCES) {
      try {
        const res = await fetch(src.url(text, lang, clamp(Number(setting('speed')) || 5, 1, 9)), { signal: AbortSignal.timeout(12000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (!looksLikeAudio(buf)) throw new Error(`返回的不是音频（${buf.length} 字节）`);
        return { buf, source: src.name };
      } catch (error) { errors.push(`${src.name}: ${error?.message || error}`); }
    }
    throw new Error(`语音合成全部失败：${errors.join('；')}`);
  }

  async function sayTo(chat, text, { dialect, incomingText } = {}) {
    let dia = normalizeDialect(dialect);
    if (!dia && setting('dialectMatch')) {
      dia = detectDialectRequest(incomingText || '') || '';
      if (!dia) {
        const guessed = detectDialect(`${incomingText || ''}\n${text}`);
        dia = guessed;
      }
    }
    if (!dia) dia = 'mandarin';
    let body = String(text || '').trim();
    if (!body) {
      const pool = SAMPLE_LINES[dia] || SAMPLE_LINES.mandarin;
      body = pool[Math.floor(Math.random() * pool.length)];
    }
    body = body.slice(0, Math.max(10, Number(setting('maxChars')) || 300));
    const { buf, source } = await synthesize(body, dia);
    await adapter.sendRecord(chat, buf.toString('base64'));
    log(`发语音：${DIALECT_LABEL[dia] || dia} / ${source} / ${body.slice(0, 20)} (${buf.length} 字节)`);
    return { dialect: dia, voice: voiceOf(dia), source, bytes: buf.length, text: body };
  }

  async function handleMessage(msg) {
    if (!msg) return { skip: false };
    if (msg.kind === 'group' && setting('requireAtInGroup') && !msg.atMe) return { skip: false };
    const parsed = parseVoiceCommand(msg.text);
    if (!parsed?.hit) return { skip: false };
    try {
      await sayTo(msg.chat, parsed.text, { dialect: parsed.dialect, incomingText: msg.text });
      return { skip: true };
    } catch (error) {
      await adapter.sendText(msg.chat, `语音没做成：${error?.message || error}`);
      return { skip: true };
    }
  }

  const disposeWs = adapter.onEvent((msg) => { handleMessage(msg).catch((e) => log(`处理消息出错：${e?.message || e}`)); });
  ctx.effect?.(() => () => disposeWs?.(), 'dsh-qq-voice-ws');

  const chatArg = {
    kind: { type: 'string', enum: ['private', 'group'], description: '会话类型', required: true },
    id: { type: 'integer', description: 'QQ 号或群号', required: true },
  };

  registerTool(ctx, {
    name: 'qq_voice_say',
    description: '合成语音并发到指定 QQ 会话。dialect 可选 mandarin/yue/northeast/shaanxi/shandong/taiwan/en/ja/ko；text 留空就随机说一句该方言的台词。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        chat: { type: 'object', description: '发送目标', required: true, additionalProperties: false, properties: chatArg },
        text: { type: 'string', description: '要念的内容' },
        dialect: { type: 'string', description: '方言/语言：mandarin/yue/northeast/shaanxi/shandong/taiwan/en/ja/ko（留空=自动判断）' },
        hintText: { type: 'string', description: '对方原话，用来判断该用什么方言（可选）' },
      },
    },
    async execute(args) {
      const out = await sayTo(args.chat, args.text, { dialect: args.dialect, incomingText: args.hintText });
      return { ok: true, ...out };
    },
  });

  registerTool(ctx, {
    name: 'qq_voice_status',
    description: '查看语音插件状态：edge-tts 解释器、各方言音色、语速音调、能否发消息。',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    async execute() {
      let self = null;
      try { self = await adapter.getSelfInfo(); } catch { /* ignore */ }
      const voices = {};
      for (const key of Object.keys(DIALECT_VOICES)) voices[key] = { label: DIALECT_LABEL[key], voice: voiceOf(key) };
      return {
        edgePython: setting('edgePython'),
        speed: setting('speed'),
        pitchHz: setting('pitchHz'),
        dialectMatch: Boolean(setting('dialectMatch')),
        maxChars: setting('maxChars'),
        voices,
        onebotHttpUrl: setting('onebotHttpUrl'),
        wsConfigured: Boolean(setting('onebotWsUrl')),
        wsConnected: adapter.connected,
        self,
      };
    },
  });

  ctx.__qqVoice = { handleMessage, sayTo, synthesize, adapter, cfg };
  log(`语音插件就绪（edge-tts：${setting('edgePython')}；音色：${voiceOf('mandarin')}；WebSocket：${setting('onebotWsUrl') ? '已配置' : '未配置'}）`);
}

export const _internal = { DIALECT_LABEL, DIALECT_VOICES, parseVoiceCommand, detectDialect, detectDialectRequest, normalizeDialect };
