// schema.js
import {
  pgTable,
  serial,
  text,
  jsonb,
  boolean,
  varchar,
  integer,
  date,
  pgEnum,
  timestamp,
  numeric,
  unique,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations} from 'drizzle-orm';
// Enums
export const userRole = pgEnum('user_role', ['coach', 'client']);
export const body_part  = pgEnum('region', ['biceps','triceps','chest','back','legs','abs','shoulders']);


// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  first_name: varchar('first_name').notNull(),
  last_name: varchar('last_name').notNull(),
  email: text('email').notNull().unique(),       // unique login email
  /** Optional @handle-style id; lowercase a-z0-9._ , unique when set. */
  username: varchar('username', { length: 30 }).unique(),
  /** false until user picks a unique username (/setup/username) after register. */
  username_setup_done: boolean('username_setup_done').notNull().default(true),
  date_of_birth: date('date_of_birth').notNull(),
  password_hash: text('password_hash').notNull(),          // hashed password
  role: userRole('role').notNull(),
  created_at: timestamp('created_at').defaultNow(), // account creation timestamp
  /** false = show TDEE onboarding after login/register; true = skip. */
  tdee_onboarding_done: boolean('tdee_onboarding_done').notNull().default(true),
  /** Paid 1:1 coaching tier (Stripe webhook sets this in production). */
  premium_coaching_active: boolean('premium_coaching_active').notNull().default(false),

  email_verified: boolean('email_verified').notNull().default(false),
  /** HMAC hash of 6-digit registration verification code. */
  email_verification_token: varchar('email_verification_token', { length: 128 }),
  email_verification_expires_at: timestamp('email_verification_expires_at'),
  email_verification_sent_at: timestamp('email_verification_sent_at'),

  password_reset_code_hash: varchar('password_reset_code_hash', { length: 128 }),
  password_reset_expires_at: timestamp('password_reset_expires_at'),
  password_reset_sent_at: timestamp('password_reset_sent_at'),
  failed_login_count: integer('failed_login_count').notNull().default(0),

  /** https URL or site path. Null = default /sub5.png (public asset). */
  profile_image_url: text('profile_image_url'),

});

/** Undirected edge: always store with user_a_id < user_b_id (see social routes). */
export const userFriendships = pgTable(
  'user_friendships',
  {
    user_a_id: integer('user_a_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    user_b_id: integer('user_b_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at').defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.user_a_id, t.user_b_id] })]
);

export const friendRequests = pgTable('friend_requests', {
  id: serial('id').primaryKey(),
  from_user_id: integer('from_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  to_user_id: integer('to_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  created_at: timestamp('created_at').defaultNow(),
});

export const directMessages = pgTable('direct_messages', {
  id: serial('id').primaryKey(),
  sender_id: integer('sender_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  recipient_id: integer('recipient_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  image_mime: varchar('image_mime', { length: 64 }),
  image_base64: text('image_base64'),
  created_at: timestamp('created_at').defaultNow(),
});

// Exercises table (+ library metadata)
export const exercises = pgTable('exercises', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  body_part: body_part('body_part').notNull(),
  instructions: text('instructions'),
  video_url: text('video_url'),
  equipment: varchar('equipment', { length: 60 }),
  level: varchar('level', { length: 20 }),
  created_at: timestamp('created_at').defaultNow(),
});

// Daily logs table
export const daily_logs = pgTable(
  'daily_logs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id),
    date: date('date').notNull(),
    steps: integer('steps'),
    calories: integer('calories'),
  },
  (t) => ({
    dailyLogsUserDate: unique('daily_logs_user_date_uidx').on(t.userId, t.date),
  })
);

/** Baseline (onboarding) TDEE + EMA-based dynamic estimate. */
export const userTdeeState = pgTable('user_tdee_state', {
  user_id: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  baseline_tdee: integer('baseline_tdee').notNull(),
  ema_tdee: numeric('ema_tdee', { precision: 10, scale: 1 }),
  ema_intake: numeric('ema_intake', { precision: 10, scale: 1 }),
  updated_at: timestamp('updated_at').defaultNow(),
});

/** Big-3 strength profile + classification (StrengthLevel-style ratios vs bodyweight). */
export const userStrengthProfile = pgTable('user_strength_profile', {
  user_id: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  years_lifting: numeric('years_lifting', { precision: 5, scale: 1 }),
  bench_variation: varchar('bench_variation', { length: 40 }),
  bench_lb: numeric('bench_lb', { precision: 8, scale: 1 }).notNull(),
  baseline_bench_lb: numeric('baseline_bench_lb', { precision: 8, scale: 1 }),
  squat_variation: varchar('squat_variation', { length: 40 }),
  squat_lb: numeric('squat_lb', { precision: 8, scale: 1 }).notNull(),
  baseline_squat_lb: numeric('baseline_squat_lb', { precision: 8, scale: 1 }),
  hinge_variation: varchar('hinge_variation', { length: 40 }),
  hinge_lb: numeric('hinge_lb', { precision: 8, scale: 1 }).notNull(),
  baseline_hinge_lb: numeric('baseline_hinge_lb', { precision: 8, scale: 1 }),
  bench_level: varchar('bench_level', { length: 24 }),
  squat_level: varchar('squat_level', { length: 24 }),
  hinge_level: varchar('hinge_level', { length: 24 }),
  overall_level: varchar('overall_level', { length: 24 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const strengthSnapshots = pgTable(
  'strength_snapshots',
  {
    id: serial('id').primaryKey(),
    user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    bench_lb: numeric('bench_lb', { precision: 8, scale: 1 }),
    squat_lb: numeric('squat_lb', { precision: 8, scale: 1 }),
    hinge_lb: numeric('hinge_lb', { precision: 8, scale: 1 }),
  },
  (t) => ({
    strengthSnapUserDate: unique('strength_snapshots_user_date').on(t.user_id, t.date),
  })
);

/** Weight + body fat for Lyle BMR (LBM/FM). One row per user per calendar day. */
export const bodyMetrics = pgTable(
  'body_metrics',
  {
    id: serial('id').primaryKey(),
    user_id: integer('user_id').notNull().references(() => users.id),
    date: date('date').notNull(),
    weight_kg: numeric('weight_kg', { precision: 7, scale: 2 }).notNull(),
    body_fat_pct: numeric('body_fat_pct', { precision: 5, scale: 2 }),
  },
  (t) => ({
    bodyMetricsUserDate: unique('body_metrics_user_date').on(t.user_id, t.date),
  })
);

/** Per-day steps + exercise blocks for TDEE multipliers. */
export const dailyTdeeInputs = pgTable(
  'daily_tdee_inputs',
  {
    id: serial('id').primaryKey(),
    user_id: integer('user_id').notNull().references(() => users.id),
    date: date('date').notNull(),
    steps: integer('steps').notNull().default(0),
    activities: jsonb('activities').notNull().default([]),
  },
  (t) => ({
    dailyTdeeUserDate: unique('daily_tdee_user_date').on(t.user_id, t.date),
  })
);

//Workout session log
export const workoutSessions = pgTable('workout_sessions', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id), // Links this session to a specific person
  name: text('name').notNull(),
  notes: text('notes'),
  is_template: boolean('is_template').default(false),
  date: timestamp('date').defaultNow(), // When the workout happened
  endTime: timestamp('end_time'),
  createdAt: timestamp('created_at').defaultNow(), // When this record was created in the DB
});

/** USDA-style foods; macros per 100 g. */
export const foodCatalog = pgTable('food_catalog', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  kcal_per_100g: numeric('kcal_per_100g', { precision: 8, scale: 2 }).notNull(),
  protein_per_100g: numeric('protein_per_100g', { precision: 8, scale: 2 }).notNull(),
  carbs_per_100g: numeric('carbs_per_100g', { precision: 8, scale: 2 }).notNull(),
  fat_per_100g: numeric('fat_per_100g', { precision: 8, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
});

/** lose | maintain | gain + signed weekly kg change (negative = cutting). */
export const userMacroPlan = pgTable('user_macro_plan', {
  user_id: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  goal: varchar('goal', { length: 16 }).notNull().default('maintain'),
  weekly_change_kg: numeric('weekly_change_kg', { precision: 6, scale: 2 }).notNull().default('0'),
  custom_protein_g: numeric('custom_protein_g', { precision: 8, scale: 2 }),
  custom_carbs_g: numeric('custom_carbs_g', { precision: 8, scale: 2 }),
  custom_fat_g: numeric('custom_fat_g', { precision: 8, scale: 2 }),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const foodLogEntries = pgTable('food_log_entries', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  food_catalog_id: integer('food_catalog_id')
    .notNull()
    .references(() => foodCatalog.id),
  grams: numeric('grams', { precision: 10, scale: 2 }).notNull(),
  meal_slot: varchar('meal_slot', { length: 24 }).notNull().default('uncategorized'),
  created_at: timestamp('created_at').defaultNow(),
});

export const exerciseLog = pgTable('exercise_logs', {
  id: serial('id').primaryKey(),
  workoutSessionsId: integer('workout_sessions_id').references(() => workoutSessions.id),
  exercise_id: integer('exercise_id').references(() => exercises.id),
  // Change 'sets' from integer to jsonb to store the array of set objects
  sets: jsonb('sets').default([]), 
  // We can keep these as "Top Level" summaries if you want, 
  // or remove them since the data is now inside the 'sets' JSON
  reps: integer('reps'),
  rpe: numeric('rpe', { precision: 3, scale: 1 }), 
  weight: numeric('weight', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
});
/** Explicit coach -> client roster link (the app has no coach_id otherwise). */
export const coachClients = pgTable(
  'coach_clients',
  {
    id: serial('id').primaryKey(),
    coach_id: integer('coach_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    client_id: integer('client_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    /** Denominator for the engine's training-adherence %. */
    weekly_training_target: integer('weekly_training_target').notNull().default(4),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    created_at: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    coachClientsUnique: unique('coach_clients_unique').on(t.coach_id, t.client_id),
  })
);

/** Coach -> client planned workouts ("programs"). One row = one planned session. */
export const assignedWorkouts = pgTable('assigned_workouts', {
  id: serial('id').primaryKey(),
  coach_id: integer('coach_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  client_id: integer('client_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  notes: text('notes'),
  /** Day the workout is planned for; drives weekly grouping + adherence. */
  scheduled_date: date('scheduled_date'),
  /** [{ exercise_id, name, body_part, sets, reps, weight, notes }] */
  exercises: jsonb('exercises').notNull().default([]),
  /** assigned | completed | skipped */
  status: varchar('status', { length: 20 }).notNull().default('assigned'),
  completed_session_id: integer('completed_session_id').references(() => workoutSessions.id, { onDelete: 'set null' }),
  completed_at: timestamp('completed_at'),
  created_at: timestamp('created_at').defaultNow(),
});

/** Duty of care: per-client safeguarding + intake (PAR-Q + wellbeing). */
export const clientSafeguarding = pgTable('client_safeguarding', {
  client_id: integer('client_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  /** When true, client-facing views show adherence only, never raw kcal/weight. */
  hide_raw_numbers: boolean('hide_raw_numbers').notNull().default(false),
  par_q: jsonb('par_q'),
  screen_completed: boolean('screen_completed').notNull().default(false),
  wellbeing_note: text('wellbeing_note'),
  support_region: varchar('support_region', { length: 8 }).notNull().default('UK'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

/** Weekly wellbeing check-in -> the report 'checkin' section. */
export const weeklyCheckins = pgTable(
  'weekly_checkins',
  {
    id: serial('id').primaryKey(),
    client_id: integer('client_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    week_start: date('week_start').notNull(),
    sleep_h: numeric('sleep_h', { precision: 4, scale: 1 }),
    energy_1to5: integer('energy_1to5'),
    stress_1to5: integer('stress_1to5'),
    notes: text('notes'),
    created_at: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    weeklyCheckinsUnique: unique('weekly_checkins_unique').on(t.client_id, t.week_start),
  })
);

/** Persisted weekly report per client per week (PDF stored in-DB as base64). */
export const weeklyReports = pgTable(
  'weekly_reports',
  {
    id: serial('id').primaryKey(),
    coach_id: integer('coach_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    client_id: integer('client_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    week_start: date('week_start').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    flags: jsonb('flags').notNull().default([]),
    model: jsonb('model').notNull(),
    pdf_base64: text('pdf_base64'),
    pdf_mime: varchar('pdf_mime', { length: 64 }).notNull().default('application/pdf'),
    generated_at: timestamp('generated_at').defaultNow(),
  },
  (t) => ({
    weeklyReportsUnique: unique('weekly_reports_unique').on(t.client_id, t.week_start),
  })
);

/** The engine's standalone HTML dashboard, one per coach per week. */
export const weeklyDashboards = pgTable(
  'weekly_dashboards',
  {
    coach_id: integer('coach_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    week_start: date('week_start').notNull(),
    html: text('html').notNull(),
    generated_at: timestamp('generated_at').defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.coach_id, t.week_start] })]
);

/** Coach-built forms (intake / check-in questionnaires). */
export const coachForms = pgTable('coach_forms', {
  id: serial('id').primaryKey(),
  coach_id: integer('coach_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  /** [{ id, label, type:'text'|'textarea'|'number'|'scale', required }] */
  fields: jsonb('fields').notNull().default([]),
  created_at: timestamp('created_at').defaultNow(),
});

export const formAssignments = pgTable(
  'form_assignments',
  {
    id: serial('id').primaryKey(),
    form_id: integer('form_id').notNull().references(() => coachForms.id, { onDelete: 'cascade' }),
    client_id: integer('client_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    created_at: timestamp('created_at').defaultNow(),
  },
  (t) => ({ formAssignmentsUnique: unique('form_assignments_unique').on(t.form_id, t.client_id) })
);

export const formResponses = pgTable(
  'form_responses',
  {
    id: serial('id').primaryKey(),
    form_id: integer('form_id').notNull().references(() => coachForms.id, { onDelete: 'cascade' }),
    client_id: integer('client_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    answers: jsonb('answers').notNull().default({}),
    submitted_at: timestamp('submitted_at').defaultNow(),
  },
  (t) => ({ formResponsesUnique: unique('form_responses_unique').on(t.form_id, t.client_id) })
);

/** Client profile depth: coach-owned goal/notes/injuries + profile-card fields. */
export const clientProfile = pgTable('client_profile', {
  client_id: integer('client_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  goal_text: text('goal_text'),
  goal_date: date('goal_date'),
  coach_notes: text('coach_notes'),
  injuries: text('injuries'),
  phone: varchar('phone', { length: 40 }),
  location: varchar('location', { length: 120 }),
  package: varchar('package', { length: 120 }),
  updated_at: timestamp('updated_at').defaultNow(),
});

/** Body measurements beyond weight/body-fat: chest, waist, hips, arm, etc. */
export const bodyMeasurements = pgTable(
  'body_measurements',
  {
    id: serial('id').primaryKey(),
    client_id: integer('client_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    metric: varchar('metric', { length: 40 }).notNull(),
    value: numeric('value', { precision: 8, scale: 2 }).notNull(),
    unit: varchar('unit', { length: 12 }).notNull().default('cm'),
    created_at: timestamp('created_at').defaultNow(),
  },
  (t) => ({ bodyMeasurementsUnique: unique('body_measurements_unique').on(t.client_id, t.date, t.metric) })
);

/** Progress photos stored in-DB as base64. */
export const progressPhotos = pgTable('progress_photos', {
  id: serial('id').primaryKey(),
  client_id: integer('client_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  angle: varchar('angle', { length: 20 }),
  image_mime: varchar('image_mime', { length: 64 }),
  image_base64: text('image_base64').notNull(),
  note: text('note'),
  created_at: timestamp('created_at').defaultNow(),
});

/** Coach resource library shared with clients. */
export const coachTutorials = pgTable('coach_tutorials', {
  id: serial('id').primaryKey(),
  coach_id: integer('coach_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  url: text('url'),
  category: varchar('category', { length: 60 }),
  created_at: timestamp('created_at').defaultNow(),
});

/** Coach -> client tasks & habits. */
export const clientTasks = pgTable('client_tasks', {
  id: serial('id').primaryKey(),
  coach_id: integer('coach_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  client_id: integer('client_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  /** task | habit */
  kind: varchar('kind', { length: 12 }).notNull().default('task'),
  due_date: date('due_date'),
  active: boolean('active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow(),
});

export const taskCompletions = pgTable(
  'task_completions',
  {
    id: serial('id').primaryKey(),
    task_id: integer('task_id').notNull().references(() => clientTasks.id, { onDelete: 'cascade' }),
    client_id: integer('client_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    created_at: timestamp('created_at').defaultNow(),
  },
  (t) => ({ taskCompletionsUnique: unique('task_completions_unique').on(t.task_id, t.date) })
);

/** Coach documents (per-client when client_id set, else shared with roster). */
export const coachDocuments = pgTable('coach_documents', {
  id: serial('id').primaryKey(),
  coach_id: integer('coach_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  client_id: integer('client_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  url: text('url'),
  note: text('note'),
  created_at: timestamp('created_at').defaultNow(),
});

/** Per-client meal plan (targets + structured meals). */
export const mealPlans = pgTable('meal_plans', {
  id: serial('id').primaryKey(),
  coach_id: integer('coach_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  client_id: integer('client_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  target_calories: integer('target_calories'),
  target_protein_g: integer('target_protein_g'),
  target_carbs_g: integer('target_carbs_g'),
  target_fat_g: integer('target_fat_g'),
  /** [{ name, items: [string], notes }] */
  meals: jsonb('meals').notNull().default([]),
  notes: text('notes'),
  active: boolean('active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
    workoutSessions: many(workoutSessions),
}));

export const workoutSessionsRelations = relations(workoutSessions, ({ one, many }) => ({
    user: one(users, {
        fields: [workoutSessions.user_id],
        references: [users.id],
    }),
    // Move this out of the 'user' object:
    exerciseLogs: many(exerciseLog), 
}));

export const exerciseLogRelations = relations(exerciseLog, ({ one }) => ({
    // ADD THIS: A log belongs to one session
    session: one(workoutSessions, {
        fields: [exerciseLog.workoutSessionsId],
        references: [workoutSessions.id],
    }),
    // ADD THIS: A log refers to one exercise definition
    exercise: one(exercises, {
        fields: [exerciseLog.exercise_id],
        references: [exercises.id],
    }),
}));

