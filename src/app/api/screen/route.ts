/**
 * src/app/api/screen/route.ts
 * ===========================
 * Endpoint skrining klinis PHQ-9 dan GAD-7.
 * Scoring sepenuhnya deterministik — tidak ada LLM, tidak ada streaming.
 */

import { formatResult, getQuestions, scoreScreening } from '@/lib/screening'
import { incrementMetric } from '@/lib/metrics'

export async function POST(req: Request): Promise<Response> {
  const body = await req.json()
  const { qtype, answers } = body

  // ── Validasi qtype ─────────────────────────────────────────────────────────
  if (qtype !== 'PHQ-9' && qtype !== 'GAD-7') {
    return Response.json({ error: 'qtype tidak valid' }, { status: 400 })
  }

  // ── Validasi jumlah jawaban ────────────────────────────────────────────────
  const questions = getQuestions(qtype)
  if (!Array.isArray(answers) || answers.length !== questions.length) {
    return Response.json({ error: 'Jumlah jawaban tidak sesuai' }, { status: 400 })
  }

  // ── Validasi nilai jawaban (harus integer 0–3) ─────────────────────────────
  if (answers.some((a: unknown) => !Number.isInteger(a) || (a as number) < 0 || (a as number) > 3)) {
    return Response.json({ error: 'Nilai jawaban harus 0-3' }, { status: 400 })
  }

  const result   = scoreScreening(qtype, answers as number[])
  const markdown = formatResult(result)

  // Fire-and-forget — tidak menunggu/blokir response ke user
  void incrementMetric(qtype === 'PHQ-9' ? 'phq9Completed' : 'gad7Completed')

  return Response.json({ result, markdown })
}
