// schema.js
import { pgTable, serial, text, jsonb, boolean, varchar, integer, date, pgEnum, timestamp, numeric } from 'drizzle-orm/pg-core';
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

});

// Exercises table
export const exercises = pgTable('exercises', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  body_part: body_part('body_part').notNull(),
});

// Daily logs table
export const daily_logs = pgTable('daily_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  date: date('date').notNull(),
  steps: integer('steps'),
});

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

