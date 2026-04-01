// schema.js
import { pgTable, serial, text, jsonb, boolean, varchar, integer, date, pgEnum, timestamp, numeric, unique } from 'drizzle-orm/pg-core';
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
  date_of_birth: date('date_of_birth').notNull(),
  password_hash: text('password_hash').notNull(),          // hashed password
  role: userRole('role').notNull(),
  created_at: timestamp('created_at').defaultNow(), // account creation timestamp
  /** false = show TDEE onboarding after login/register; true = skip. */
  tdee_onboarding_done: boolean('tdee_onboarding_done').notNull().default(true),

});

// Exercises table
export const exercises = pgTable('exercises', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  body_part: body_part('body_part').notNull(),
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

