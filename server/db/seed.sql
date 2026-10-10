-- ============================================================
-- QuizMind AI -- Seed Data
-- Inserts the 4 domains and all subjects.
-- Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING.
-- ============================================================

-- ------------------------------------------------------------
-- Domains
-- ------------------------------------------------------------
INSERT INTO domains (name, description, icon) VALUES
  (
    'General Intelligence & Awareness',
    'Indian history, polity, constitution, current affairs, geography and general science',
    '🧠'
  ),
  (
    'Verbal Ability',
    'English grammar, vocabulary, comprehension and language skills',
    '📝'
  ),
  (
    'Analytical & Quantitative Ability',
    'Aptitude, logical reasoning, numerical ability and data interpretation',
    '📊'
  ),
  (
    'Technical Subjects',
    'Core computer science and engineering topics',
    '💻'
  )
ON CONFLICT (name) DO NOTHING;


-- ------------------------------------------------------------
-- Subjects -- General Intelligence & Awareness
-- ------------------------------------------------------------
INSERT INTO subjects (domain_id, name, description)
SELECT d.id, s.name, s.description
FROM domains d,
  (VALUES
    ('Indian History',       'Ancient, medieval and modern Indian history'),
    ('Indian Polity',        'Indian political system, governance and institutions'),
    ('Indian Constitution',  'Structure, articles, amendments and features of the Indian Constitution'),
    ('Current Affairs',      'Recent national and international events and developments'),
    ('Geography',            'Physical, human and economic geography of India and the world'),
    ('General Science',      'Basic concepts of physics, chemistry and biology')
  ) AS s(name, description)
WHERE d.name = 'General Intelligence & Awareness'
ON CONFLICT (domain_id, name) DO NOTHING;


-- ------------------------------------------------------------
-- Subjects -- Verbal Ability
-- ------------------------------------------------------------
INSERT INTO subjects (domain_id, name, description)
SELECT d.id, s.name, s.description
FROM domains d,
  (VALUES
    ('Tenses',               'Present, past and future tense usage in English'),
    ('Articles',             'Usage of definite and indefinite articles: a, an, the'),
    ('Prepositions',         'Correct usage of prepositions in sentences'),
    ('Verb Forms',           'Correct forms of verbs including irregular verbs'),
    ('Parts of Speech',      'Nouns, pronouns, adjectives, adverbs and their usage'),
    ('Sentence Completion',  'Fill in the blanks with appropriate words or phrases'),
    ('Synonyms & Antonyms',  'Words with similar and opposite meanings'),
    ('Error Detection',      'Identify grammatical errors in sentences')
  ) AS s(name, description)
WHERE d.name = 'Verbal Ability'
ON CONFLICT (domain_id, name) DO NOTHING;


-- ------------------------------------------------------------
-- Subjects -- Analytical & Quantitative Ability
-- ------------------------------------------------------------
INSERT INTO subjects (domain_id, name, description)
SELECT d.id, s.name, s.description
FROM domains d,
  (VALUES
    ('Quantitative Aptitude',  'Arithmetic, algebra, geometry and number systems'),
    ('Logical Reasoning',      'Patterns, sequences, syllogisms and logical deductions'),
    ('Numerical Ability',      'Speed, accuracy and numerical computation skills'),
    ('Data Interpretation',    'Analysis of charts, graphs, tables and data sets')
  ) AS s(name, description)
WHERE d.name = 'Analytical & Quantitative Ability'
ON CONFLICT (domain_id, name) DO NOTHING;


-- ------------------------------------------------------------
-- Subjects -- Technical Subjects
-- ------------------------------------------------------------
INSERT INTO subjects (domain_id, name, description)
SELECT d.id, s.name, s.description
FROM domains d,
  (VALUES
    ('Machine Learning',               'Supervised and unsupervised learning, algorithms and model evaluation'),
    ('Artificial Intelligence',        'Search algorithms, knowledge representation and AI fundamentals'),
    ('Computer Networks',              'OSI model, TCP/IP, protocols, routing and network security'),
    ('Operating Systems',              'Processes, threads, memory management, scheduling and file systems'),
    ('Database Management Systems',    'SQL, relational model, normalization, transactions and indexing'),
    ('Data Structures & Algorithms',   'Arrays, trees, graphs, sorting, searching and complexity analysis'),
    ('Object-Oriented Programming',    'Classes, objects, inheritance, polymorphism, encapsulation and abstraction')
  ) AS s(name, description)
WHERE d.name = 'Technical Subjects'
ON CONFLICT (domain_id, name) DO NOTHING;
