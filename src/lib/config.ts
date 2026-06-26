/**
 * src/lib/config.ts
 * =================
 * Semua konfigurasi, konstanta, dan konten klinis CL-RAG v5.
 * Port dari modules/config.py (Python v4)
 */

// ── TypeScript Types ───────────────────────────────────────────────────────────

export interface Threshold {
  ceiling: number
  level: string
  desc: string
  rec: string
}

export interface SeedDocument {
  source: string
  text: string
  tags: string
}

// ── Model & Retrieval ──────────────────────────────────────────────────────────

export const EMBEDDING_MODEL       = process.env.EMBEDDING_MODEL      ?? 'intfloat/multilingual-e5-base'
export const TOP_K                 = parseInt(process.env.TOP_K         ?? '4', 10)
export const MIN_SIMILARITY        = parseFloat(process.env.MIN_SIMILARITY ?? '0.22')
export const CHUNK_MAX_CHARS       = parseInt(process.env.CHUNK_MAX_CHARS   ?? '600', 10)
export const CHUNK_OVERLAP         = parseInt(process.env.CHUNK_OVERLAP     ?? '1', 10)
export const MAX_HISTORY_PAIRS     = parseInt(process.env.MAX_HISTORY_PAIRS ?? '10', 10)
export const STREAM_YIELD_TOKENS   = parseInt(process.env.STREAM_YIELD_TOKENS ?? '6', 10)
export const SIGNAL_THRESHOLD      = parseInt(process.env.SIGNAL_THRESHOLD   ?? '2', 10)

// ── Gemini (baru di v5) ────────────────────────────────────────────────────────

export const GEMINI_MODEL           = 'gemini-2.5-flash'  // gemini-2.0-flash shutdown 1 Jun 2026
export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001'  // text-embedding-004 dimatikan 14 Jan 2026
export const EMBEDDING_DIMENSIONS   = 768  // di-scale-down via outputDimensionality (default model: 3072)

// ── Storage & Pinecone ────────────────────────────────────────────────────────

export const PINECONE_INDEX        = process.env.PINECONE_INDEX        ?? 'mental-health-kb'
export const CHROMA_COLLECTION     = process.env.CHROMA_COLLECTION     ?? 'mental_health_kb'

// ── Prompts ────────────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `Kamu adalah asisten kesehatan mental yang membantu, empatik, dan berbasis bukti ilmiah.

ATURAN PENTING:
1. Jawab HANYA berdasarkan referensi ilmiah yang diberikan. Jangan mengarang.
2. Jika referensi tidak cukup, katakan dengan jujur bahwa kamu tidak tahu.
3. Gunakan Bahasa Indonesia yang hangat, mudah dipahami, dan tidak menggurui.
4. Selalu ingatkan bahwa kamu bukan pengganti konsultasi dengan profesional kesehatan mental.
5. Sebutkan [Ref X] di dalam jawaban ketika menggunakan referensi tersebut.`

export const DISCLAIMER = (
  '⚠️ **Disclaimer:** Sistem ini adalah alat bantu edukasi berbasis referensi ilmiah — ' +
  'bukan pengganti diagnosis atau konsultasi dengan psikolog/psikiater berlisensi.'
)

export const CRISIS_DISCLAIMER = (
  '🆘 **Jika kamu sedang dalam krisis atau membutuhkan bantuan segera:** ' +
  'Hubungi Into The Light Indonesia di **119 ext 8** atau kunjungi IGD rumah sakit terdekat.'
)

// ── Keyword Lists ──────────────────────────────────────────────────────────────

export const CRISIS_KEYWORDS: string[] = [
  'ingin mati', 'mau mati', 'bunuh diri', 'menyakiti diri', 'tidak mau hidup',
  'cape hidup', 'lebih baik mati', 'tidak ada gunanya hidup', 'sudah tidak kuat',
]

export const DEPRESSION_TRIGGERS: string[] = [
  'sedih', 'depresi', 'murung', 'tidak bersemangat', 'putus asa', 'hopeless',
  'tidak ada harapan', 'ingin mati', 'cape hidup', 'tidak berguna', 'lelah terus',
  'tidak mau bangun', 'menangis terus', 'hampa', 'kosong', 'tidak bahagia',
  'kehilangan minat', 'tidak semangat', 'menyerah', 'tidak bisa tidur',
  'tidak nafsu makan', 'merasa gagal',
]

export const ANXIETY_TRIGGERS: string[] = [
  'cemas', 'khawatir', 'anxiety', 'panik', 'takut berlebihan', 'gelisah',
  'overthinking', 'jantung berdebar', 'sesak', 'tidak tenang', 'was-was',
  'nervous', 'gugup berlebihan', 'serangan panik', 'fobia', 'tegang terus',
  'tidak bisa santai', 'pikiran tidak bisa berhenti', 'khawatir terus',
]

// ── Clinical Questionnaires ────────────────────────────────────────────────────

export const PHQ9_QUESTIONS: string[] = [
  'Kurang tertarik atau tidak bergairah dalam melakukan apapun',
  'Merasa sedih, murung, atau putus asa',
  'Sulit tidur atau terlalu banyak tidur',
  'Merasa lelah atau tidak bertenaga',
  'Kurang nafsu makan atau terlalu banyak makan',
  'Merasa buruk tentang diri sendiri — merasa gagal atau mengecewakan diri dan keluarga',
  'Sulit berkonsentrasi pada sesuatu, misalnya membaca atau menonton TV',
  'Bergerak atau berbicara sangat lambat sehingga orang lain memperhatikan; ' +
    'atau sebaliknya sangat gelisah sehingga lebih sering bergerak dari biasanya',
  'Ada pikiran bahwa lebih baik mati, atau ingin menyakiti diri sendiri',
]

export const GAD7_QUESTIONS: string[] = [
  'Merasa gugup, cemas, atau sangat tegang',
  'Tidak mampu menghentikan atau mengendalikan rasa khawatir',
  'Terlalu banyak khawatir tentang berbagai hal',
  'Sulit untuk santai',
  'Sangat gelisah sehingga sulit untuk duduk diam',
  'Mudah jengkel atau mudah marah',
  'Merasa takut seolah sesuatu yang mengerikan akan terjadi',
]

// ── PHQ-9 / GAD-7 Scoring Thresholds ──────────────────────────────────────────
// Sumber: Kroenke et al., 2001 (PHQ-9) & Spitzer et al., 2006 (GAD-7)

export const PHQ9_THRESHOLDS: Threshold[] = [
  { ceiling: 4,  level: 'Minimal',     desc: 'Gejala depresi minimal.',     rec: 'Tidak ada tindak lanjut khusus.' },
  { ceiling: 9,  level: 'Ringan',      desc: 'Depresi ringan.',              rec: 'Coba self-care: olahraga, tidur cukup, journaling.' },
  { ceiling: 14, level: 'Sedang',      desc: 'Depresi sedang.',              rec: 'Disarankan konsultasi dengan psikolog.' },
  { ceiling: 19, level: 'Cukup Berat', desc: 'Depresi cukup berat.',         rec: 'Sangat disarankan segera menemui psikolog/psikiater.' },
  { ceiling: 27, level: 'Berat',       desc: 'Depresi berat.',               rec: 'Segera cari bantuan profesional.' },
]

export const GAD7_THRESHOLDS: Threshold[] = [
  { ceiling: 4,  level: 'Minimal', desc: 'Gejala kecemasan minimal.',  rec: 'Tidak ada tindak lanjut khusus.' },
  { ceiling: 9,  level: 'Ringan',  desc: 'Kecemasan ringan.',          rec: 'Teknik relaksasi dan mindfulness dapat membantu.' },
  { ceiling: 14, level: 'Sedang',  desc: 'Kecemasan sedang.',          rec: 'Disarankan konsultasi dengan psikolog.' },
  { ceiling: 21, level: 'Berat',   desc: 'Kecemasan berat.',           rec: 'Sangat disarankan segera menemui psikolog/psikiater.' },
]

// ── Seed Knowledge Base ────────────────────────────────────────────────────────

export const SEED_DOCUMENTS: SeedDocument[] = [
  {
    source: 'Beck et al., 2021 — Journal of Affective Disorders',
    text: (
      'Depression is characterized by persistent low mood, loss of interest ' +
      'in activities once enjoyed, and a range of emotional and physical symptoms. ' +
      'Common symptoms include fatigue, changes in appetite, difficulty concentrating, ' +
      'feelings of worthlessness, and in severe cases, suicidal ideation. ' +
      'Cognitive behavioral therapy (CBT) has been shown to be highly effective ' +
      'in treating mild to moderate depression, with effects comparable to antidepressants.'
    ),
    tags: 'depresi, CBT, gejala, terapi',
  },
  {
    source: 'Hofmann et al., 2020 — Psychological Medicine',
    text: (
      'Anxiety disorders encompass a group of mental health conditions marked by ' +
      'excessive fear or worry that interferes with daily functioning. Generalized ' +
      'Anxiety Disorder (GAD) involves chronic, uncontrollable worry about multiple ' +
      'life domains. Physical symptoms include muscle tension, restlessness, and ' +
      'sleep disturbances. First-line treatments include CBT and SSRIs. ' +
      'Exposure therapy is particularly effective for specific phobias and social anxiety.'
    ),
    tags: 'kecemasan, GAD, SSRI, CBT',
  },
  {
    source: 'Walker, 2022 — Sleep Medicine Reviews',
    text: (
      'Chronic sleep deprivation significantly impacts mental health by amplifying ' +
      'emotional reactivity and impairing prefrontal cortex regulation. Studies show ' +
      'people sleeping fewer than 6 hours per night have a 2.5x higher risk of ' +
      'developing depression. Sleep hygiene interventions such as consistent sleep ' +
      'schedules, limiting screen exposure before bed, and avoiding caffeine after noon ' +
      'are effective first steps. Cognitive Behavioral Therapy for Insomnia (CBT-I) ' +
      'is the gold standard treatment for chronic insomnia.'
    ),
    tags: 'tidur, insomnia, sleep hygiene, depresi, CBT-I',
  },
  {
    source: 'Kroenke et al., 2001 — Journal of General Internal Medicine',
    text: (
      'The PHQ-9 is a validated 9-item self-report questionnaire used to screen for ' +
      'and measure severity of depression. Total scores range from 0-27: scores of ' +
      '5, 10, 15, and 20 represent mild, moderate, moderately severe, and severe ' +
      'depression thresholds respectively. It demonstrates high sensitivity and ' +
      'specificity (88% each) for major depressive disorder.'
    ),
    tags: 'PHQ-9, skrining, depresi, validasi',
  },
  {
    source: 'Spitzer et al., 2006 — Archives of Internal Medicine',
    text: (
      'The GAD-7 is a 7-item validated tool for screening generalized anxiety disorder. ' +
      'Total scores of 5, 10, and 15 mark mild, moderate, and severe anxiety thresholds. ' +
      'The instrument shows strong criterion validity (AUC = 0.906) and is widely used ' +
      'in primary care settings as an efficient anxiety screening measure.'
    ),
    tags: 'GAD-7, skrining, kecemasan, validasi',
  },
  {
    source: 'Lazarus & Folkman, 1984 — Psychological Stress and the Coping Process',
    text: (
      'Stress is defined as a relationship between person and environment that is ' +
      'appraised as taxing or exceeding resources and endangering well-being. ' +
      'Coping strategies are classified into problem-focused coping and ' +
      'emotion-focused coping. Effective coping is associated with better mental ' +
      'health outcomes. Social support is a crucial buffer against chronic stress.'
    ),
    tags: 'stres, coping, kesehatan mental, dukungan sosial',
  },
  {
    source: 'Nolen-Hoeksema, 2000 — Journal of Abnormal Psychology',
    text: (
      'Rumination, defined as repetitive passive focus on symptoms of distress and ' +
      'their possible causes and consequences, is a significant risk factor for ' +
      'depression and anxiety. Behavioral activation and mindfulness-based ' +
      'interventions effectively reduce rumination. Distraction and problem-solving ' +
      'are recommended alternatives to rumination.'
    ),
    tags: 'rumination, depresi, mindfulness, kecemasan',
  },
  {
    source: 'Kabat-Zinn, 2003 — Psychosomatic Medicine',
    text: (
      'Mindfulness-Based Stress Reduction (MBSR) is an 8-week structured program ' +
      'that trains participants to pay attention to present-moment experiences ' +
      'without judgment. Clinical trials demonstrate significant reductions in ' +
      'anxiety, depression, and chronic pain. MBSR has been shown to reduce cortisol ' +
      'levels and improve immune system functioning.'
    ),
    tags: 'mindfulness, MBSR, stres, kecemasan, depresi',
  },
  {
    source: 'Firth et al., 2019 — World Psychiatry',
    text: (
      'Regular physical exercise is associated with significant reductions in depression ' +
      'and anxiety symptoms across multiple meta-analyses. Aerobic exercise (150 minutes ' +
      'per week at moderate intensity) shows comparable efficacy to antidepressants ' +
      'for mild-to-moderate depression. Exercise promotes neuroplasticity through ' +
      'BDNF release and improves sleep quality.'
    ),
    tags: 'olahraga, depresi, kecemasan, neuroplastisitas',
  },
  {
    source: 'Holt-Lunstad et al., 2015 — Perspectives on Psychological Science',
    text: (
      'Social isolation and loneliness are associated with a 29% increased risk of ' +
      'mortality and significant deterioration in mental health. Strong social connections ' +
      'are as important for health as avoiding smoking. Quality of relationships matters ' +
      'more than quantity. Community participation and reducing barriers to connection ' +
      'improve outcomes for depression, anxiety, and overall well-being.'
    ),
    tags: 'isolasi sosial, kesepian, koneksi sosial, kesehatan mental',
  },
]
