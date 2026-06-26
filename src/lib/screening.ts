/**
 * src/lib/screening.ts
 * ====================
 * Mesin skrining klinis PHQ-9 dan GAD-7.
 * Port dari modules/screening.py (Python v4)
 *
 * Validasi sumber:
 *   PHQ-9 : Kroenke K, Spitzer RL, Williams JB. (2001). The PHQ-9.
 *            J Gen Intern Med. 16(9):606–613. doi:10.1046/j.1525-1497.2001.016009606.x
 *   GAD-7 : Spitzer RL, Kroenke K, Williams JB, Löwe B. (2006). A brief measure for
 *            assessing generalized anxiety disorder. Arch Intern Med. 166(10):1092–1097.
 */

import {
  ANXIETY_TRIGGERS,
  CRISIS_KEYWORDS,
  DEPRESSION_TRIGGERS,
  GAD7_QUESTIONS,
  GAD7_THRESHOLDS,
  PHQ9_QUESTIONS,
  PHQ9_THRESHOLDS,
  SIGNAL_THRESHOLD,
} from './config'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ScreeningResult {
  type: 'PHQ-9' | 'GAD-7'
  total: number
  max: number
  level: string
  desc: string
  rec: string
  answers: number[]
}

export interface SessionSignals {
  depressionSignals: number
  anxietySignals: number
  triggeredScreening: string[]
}

// ── Scoring ────────────────────────────────────────────────────────────────────

export function scoreScreening(
  qtype: 'PHQ-9' | 'GAD-7',
  answers: number[]
): ScreeningResult {
  const total      = answers.reduce((sum, a) => sum + a, 0)
  const thresholds = qtype === 'PHQ-9' ? PHQ9_THRESHOLDS : GAD7_THRESHOLDS
  const max        = qtype === 'PHQ-9' ? 27 : 21

  let level = ''
  let desc  = ''
  let rec   = ''

  for (const t of thresholds) {
    if (total <= t.ceiling) {
      level = t.level
      desc  = t.desc
      rec   = t.rec
      break
    }
  }

  return { type: qtype, total, max, level, desc, rec, answers }
}

export function getQuestions(qtype: 'PHQ-9' | 'GAD-7'): string[] {
  return qtype === 'PHQ-9' ? PHQ9_QUESTIONS : GAD7_QUESTIONS
}

// ── Result Formatter ───────────────────────────────────────────────────────────

export function formatResult(result: ScreeningResult): string {
  const barFilled = Math.floor((result.total / result.max) * 20)
  const bar       = '█'.repeat(barFilled) + '░'.repeat(20 - barFilled)

  const emojiMap: Record<string, string> = {
    'Minimal':     '🟢',
    'Ringan':      '🟡',
    'Sedang':      '🟠',
    'Cukup Berat': '🔴',
    'Berat':       '🔴',
  }
  const emoji     = emojiMap[result.level] ?? '⚪'
  const labels    = ['Tidak pernah', 'Beberapa hari', 'Lebih dari setengah hari', 'Hampir setiap hari']
  const questions = getQuestions(result.type)

  const lines: string[] = [
    `## 📊 Hasil Skrining ${result.type}`,
    '',
    `**Skor:** ${result.total} / ${result.max}`,
    `\`${bar}\` ${result.total}/${result.max}`,
    `**Tingkat:** ${emoji} ${result.level}`,
    '',
    `📝 ${result.desc}`,
    `💡 **Rekomendasi:** ${result.rec}`,
    '',
    '---',
    '### Ringkasan Jawaban:',
  ]

  questions.forEach((q, i) => {
    const a = result.answers[i]
    lines.push(`${i + 1}. ${q}: **${labels[a]}** (${a})`)
  })

  lines.push(
    '',
    '---',
    '> ⚠️ **PENTING:** Hasil ini BUKAN diagnosis klinis.',
    '> Konsultasikan dengan **psikolog atau psikiater berlisensi**.',
    '> 🆘 Darurat: **Into The Light Indonesia 119 ext 8**',
  )

  return lines.join('\n')
}

export function formatQuestionPrompt(qtype: 'PHQ-9' | 'GAD-7', qIdx: number): string {
  const questions = getQuestions(qtype)
  const total     = questions.length
  const barFill   = Math.floor((qIdx / total) * 14)
  const bar       = '█'.repeat(barFill) + '░'.repeat(14 - barFill)

  return (
    `### 📋 ${qtype} — Pertanyaan ${qIdx + 1} dari ${total}\n` +
    `\`${bar}\` ${qIdx}/${total}\n\n` +
    `**${questions[qIdx]}**\n\n` +
    `Dalam **2 minggu terakhir**, seberapa sering?\n\n` +
    `Pilih salah satu di bawah ini:`
  )
}

// ── Intent Detection ───────────────────────────────────────────────────────────

export function detectCrisis(message: string): boolean {
  const msgLower = message.toLowerCase()
  return CRISIS_KEYWORDS.some((kw) => msgLower.includes(kw))
}

/**
 * Akumulasi sinyal dan kembalikan 'PHQ-9' / 'GAD-7' / null.
 * Mutates the session object in place (mirroring Python behaviour).
 */
export function detectIntent(
  message: string,
  session: SessionSignals
): 'PHQ-9' | 'GAD-7' | null {
  const msgLower = message.toLowerCase()

  session.depressionSignals += DEPRESSION_TRIGGERS.filter((kw) =>
    msgLower.includes(kw)
  ).length

  session.anxietySignals += ANXIETY_TRIGGERS.filter((kw) =>
    msgLower.includes(kw)
  ).length

  const dep = session.depressionSignals
  const anx = session.anxietySignals

  if (anx >= SIGNAL_THRESHOLD && anx >= dep) {
    if (!session.triggeredScreening.includes('GAD-7')) {
      return 'GAD-7'
    }
  }

  if (dep >= SIGNAL_THRESHOLD) {
    if (!session.triggeredScreening.includes('PHQ-9')) {
      return 'PHQ-9'
    }
  }

  return null
}
