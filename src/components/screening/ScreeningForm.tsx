'use client'

/**
 * src/components/screening/ScreeningForm.tsx
 * ===========================================
 * Form skrining PHQ-9 atau GAD-7. Logic tidak berubah dari versi
 * sebelumnya — hanya visual yang disederhanakan ke gaya minimalis.
 */

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getQuestions } from '@/lib/screening'
import ProgressBar from './ProgressBar'

const SCORE_LABELS = [
  '0 — Tidak pernah',
  '1 — Beberapa hari',
  '2 — Lebih dari ½ hari',
  '3 — Hampir setiap hari',
]

interface ScreeningFormProps {
  qtype: 'PHQ-9' | 'GAD-7'
  onComplete?: (resultMarkdown: string) => void
}

export default function ScreeningForm({ qtype, onComplete }: ScreeningFormProps) {
  const questions = getQuestions(qtype)
  const maxScore   = qtype === 'PHQ-9' ? 27 : 21

  const [answers, setAnswers] = useState<(number | null)[]>(() => Array(questions.length).fill(null))
  const [resultMarkdown, setResultMarkdown] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setAnswers(Array(getQuestions(qtype).length).fill(null))
    setResultMarkdown(null)
    setErrorMsg(null)
  }, [qtype])

  useEffect(() => {
    if (resultMarkdown) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [resultMarkdown])

  const answered = answers.filter((a) => a !== null).length
  const allFilled = answered === questions.length
  const canSubmit = allFilled && !isLoading

  function setAnswer(idx: number, val: number) {
    setAnswers((prev) => {
      const next = [...prev]
      next[idx] = val
      return next
    })
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setIsLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qtype, answers: answers as number[] }),
      })
      const data = await res.json()

      if (data.error) {
        setErrorMsg(data.error)
      } else {
        setResultMarkdown(data.markdown)
        onComplete?.(data.markdown)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setErrorMsg(`Gagal menghubungi server: ${msg}`)
    } finally {
      setIsLoading(false)
    }
  }

  function handleReset() {
    setAnswers(Array(questions.length).fill(null))
    setResultMarkdown(null)
    setErrorMsg(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="screen-info">
        Dalam <strong style={{ color: 'var(--text-1)' }}>2 minggu terakhir</strong>, seberapa
        sering kamu mengalami hal-hal berikut?{' '}
        <span style={{ color: 'var(--text-3)' }}>
          {questions.length} pertanyaan · Skor 0–{maxScore}
        </span>
      </div>

      <ProgressBar answered={answered} total={questions.length} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {questions.map((q, idx) => {
          const isAnswered = answers[idx] !== null
          return (
            <div key={idx} className="question-card" data-answered={String(isAnswered)}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-1)', fontWeight: 500, marginBottom: '10px', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--text-3)', marginRight: '6px' }}>{idx + 1}.</span>
                {q}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '4px' }}>
                {SCORE_LABELS.map((label, val) => {
                  const isSelected = answers[idx] === val
                  return (
                    <label key={val} className="radio-option" data-selected={String(isSelected)}>
                      <input
                        type="radio"
                        name={`q-${qtype}-${idx}`}
                        value={val}
                        checked={isSelected}
                        onChange={() => setAnswer(idx, val)}
                        style={{ width: '14px', height: '14px', flexShrink: 0 }}
                      />
                      {label}
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {errorMsg && (
        <div className="crisis-notice" style={{ color: 'var(--text-2)' }}>
          {errorMsg}
        </div>
      )}

      {!resultMarkdown && (
        <button onClick={handleSubmit} disabled={!canSubmit} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
          {isLoading ? 'Menghitung...' : `Hitung Hasil ${qtype}`}
        </button>
      )}

      {resultMarkdown && (
        <div ref={resultRef}>
          <div className="md-content" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{resultMarkdown}</ReactMarkdown>
          </div>

          <button onClick={handleReset} className="btn-secondary" style={{ marginTop: '12px' }}>
            Ulangi Skrining
          </button>
        </div>
      )}
    </div>
  )
}
