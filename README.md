<div align="center">

# dsh-qq-voice

**给 DSH 用的 QQ 语音插件 · 9 种方言/语言，Edge TTS 免费合成，失败自动降级**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![DSH](https://img.shields.io/badge/DSH-%E2%89%A5%200.1-8A2BE2)
![OneBot](https://img.shields.io/badge/OneBot-v11-00A1D6)
![Node](https://img.shields.io/badge/Node-%E2%89%A5%2020-339933)
![方言](https://img.shields.io/badge/%E6%96%B9%E8%A8%80-9%20%E7%A7%8D-FF4081)
![EdgeTTS](https://img.shields.io/badge/Edge%20TTS-%E5%85%8D%E8%B4%B9-0078D4)

</div>

> 群友说「用粤语说 得闲饮茶」→ 语音条直接发过来。

---

在 QQ 里说「用粤语说 得闲饮茶」，机器人合成语音条发过来。9 种方言/语言，音色可配。

- 底座是微软 **Edge TTS**（免费、无需 key），失败自动退到百度 / 有道
- 不带内容时说一句该方言的**随机台词**（不是固定的"你好"）
- 方言自动识别：你直接说粤语台词，它也认得出该用粤语音色

---

## 指令

| 你说 | 它做什么 |
|---|---|
| `语音说 今天加班到十点` | 普通话语音条 |
| `用粤语说 得闲饮茶` | 粤语音色 |
| `发条东北话语音` | 不带内容 → 随机说一句东北话 |
| `念一下 明天记得带伞` | 普通话 |

支持的方言/语言：`普通话 粤语 东北话 陕西话 山东话 台普 英语 日语 韩语`

---

## 设置

| 字段 | 默认 | 说明 |
|---|---|---|
| `onebotHttpUrl` / `onebotWsUrl` / `onebotToken` / `onebotWsToken` / `selfId` | 见根 README | OneBot 连接 |
| `edgePython` | `python3` | 装了 `edge-tts` 的解释器路径 |
| `ttsVoice` | `zh-CN-XiaoyiNeural` | 默认（普通话）音色 |
| `voiceYue` | `zh-HK-HiuMaanNeural` | 粤语 |
| `voiceNortheast` | `zh-CN-liaoning-XiaobeiNeural` | 东北话 |
| `voiceShaanxi` | `zh-CN-shaanxi-XiaoniNeural` | 陕西话 |
| `voiceShandong` | `zh-CN-liaoning-XiaobeiNeural` | 山东话（Edge 没有山东话音色，借用辽宁的） |
| `voiceTaiwan` | `zh-TW-HsiaoChenNeural` | 台普 |
| `voiceEn` / `voiceJa` / `voiceKo` | Aria / Nanami / SunHi | 英语 / 日语 / 韩语 |
| `speed` | `5` | 语速档位（越大越快） |
| `pitchHz` | `0` | 音调偏移（Hz），别调太大，高了会失真 |
| `dialectMatch` | `true` | 按台词自动切方言音色 |

音色名都是 Edge TTS 的名字，`edge-tts --list-voices` 能看到全部。

---

## 依赖

```bash
pip install edge-tts
# 或装到独立 venv，再把 edgePython 指过去
python3 -m venv /opt/ttsvenv && /opt/ttsvenv/bin/pip install edge-tts
# edgePython: /opt/ttsvenv/bin/python
```

---

## 自测

```bash
node contract-test.mjs
node smoke-test.mjs        # 真合成一段语音并发到假 OneBot
```

---

## 已知边界

- 语音条会被 QQ 转成 silk（单声道 ~24kbps），想保原音质请用点歌插件的 `sendMode: file`；
- Edge TTS 偶发限流，插件会自动换百度 / 有道，音色会变成"通用女声"；
- 中文断句靠 Edge 自己，长句想停顿就用逗号。

---

<!-- siblings -->
## 相关插件

- [dsh-qq-sing](https://github.com/ENDDREAM-ZM/dsh-qq-sing) · QQ音乐 / 酷狗 / 网易云点歌
- [dsh-qq-image](https://github.com/ENDDREAM-ZM/dsh-qq-image) · 生图 / 封面 / 视频
- [dsh-qq-bundle](https://github.com/ENDDREAM-ZM/dsh-qq-bundle) · 三个一起装

---

## 免责声明

> [!WARNING]
> 本插件通过**非官方接口**访问 QQ，**可能违反腾讯服务条款并导致封号**。请使用**小号**测试。

| 风险 | 说明 |
|---|---|
| 账号 | 可能被限制、封禁或永久封号 |
| 数据 | 封号可能导致好友、群聊、记录不可恢复 |
| 接口 | 上游接口随时变更，功能可能突然失效 |
| 隐私 | 聊天内容会发送给你自行配置的模型服务商 |

**禁止用途**：违法违规、垃圾信息群发、诈骗骚扰、自动化养号、绕过腾讯安全风控、
大规模抓取他人数据、商业代挂代刷、侵犯他人隐私与著作权。

完整条款（含责任限制、合规检查清单、卸载方法）见 **[DISCLAIMER.md](DISCLAIMER.md)**。
