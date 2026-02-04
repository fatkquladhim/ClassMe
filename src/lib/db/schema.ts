import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  decimal,
  date,
  pgEnum,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================
// ENUMS
// ============================================

export const userTypeEnum = pgEnum("user_type", [
  "admin",
  "dosen",
  "mahasiswa",
]);

export const semesterTypeEnum = pgEnum("semester_type", ["ganjil", "genap"]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "active",
  "inactive",
  "graduated",
  "dropped",
]);

export const dosenPrivilegeTypeEnum = pgEnum("dosen_privilege_type", [
  "dosen_pendamping",
  "wali_kelas",
  "pengurus_hafalan",
  "pengurus_capaian_materi",
  "pengurus_kelas",
]);

export const mahasiswaPrivilegeTypeEnum = pgEnum("mahasiswa_privilege_type", [
  "ketua_umum",
  "ketua_kelompok",
  "kamtib",
  "ketua_fan_ilmu",
  "sekretaris",
  "bendahara",
]);

export const hafalanStatusEnum = pgEnum("hafalan_status", [
  "pending",
  "in_progress",
  "completed",
  "need_revision",
]);

export const achievementStatusEnum = pgEnum("achievement_status", [
  "not_started",
  "in_progress",
  "completed",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "late",
  "excused",
]);

export const evaluationTypeEnum = pgEnum("evaluation_type", [
  "weekly",
  "monthly",
  "semester",
  "special",
]);

export const materialTypeEnum = pgEnum("material_type", [
  "core",
  "supplementary",
  "assessment",
]);

// ============================================
// TABLES
// ============================================

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone"),
  photoUrl: text("photo_url"),
  userType: userTypeEnum("user_type").notNull().default("mahasiswa"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Academic Years table
export const academicYears = pgTable("academic_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // e.g., "2024/2025"
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Semesters table
export const semesters = pgTable("semesters", {
  id: uuid("id").primaryKey().defaultRandom(),
  academicYearId: uuid("academic_year_id")
    .notNull()
    .references(() => academicYears.id, { onDelete: "cascade" }),
  type: semesterTypeEnum("type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Classes table
export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  semesterId: uuid("semester_id")
    .notNull()
    .references(() => semesters.id, { onDelete: "cascade" }),
  description: text("description"),
  maxStudents: integer("max_students").default(30),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Class Enrollments table (Students enrolled in classes)
export const classEnrollments = pgTable(
  "class_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    semesterId: uuid("semester_id")
      .notNull()
      .references(() => semesters.id, { onDelete: "cascade" }),
    status: enrollmentStatusEnum("status").notNull().default("active"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_enrollment").on(
      table.userId,
      table.classId,
      table.semesterId
    ),
  ]
);

// Groups table (Small groups within a class)
export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  groupNumber: integer("group_number").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Group Members table
export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => classEnrollments.id, { onDelete: "cascade" }),
    isLeader: boolean("is_leader").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_group_member").on(table.groupId, table.enrollmentId),
  ]
);

// Fan Ilmu table (Study areas like Fiqh, Hadits, Tafsir)
export const fanIlmu = pgTable("fan_ilmu", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Dosen Privileges table
export const dosenPrivileges = pgTable(
  "dosen_privileges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    privilegeType: dosenPrivilegeTypeEnum("privilege_type").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    assignedBy: uuid("assigned_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("unique_dosen_privilege").on(
      table.userId,
      table.classId,
      table.privilegeType
    ),
  ]
);

// Mahasiswa Privileges table
export const mahasiswaPrivileges = pgTable(
  "mahasiswa_privileges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => classEnrollments.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    privilegeType: mahasiswaPrivilegeTypeEnum("privilege_type").notNull(),
    groupId: uuid("group_id").references(() => groups.id, {
      onDelete: "set null",
    }),
    fanIlmuId: uuid("fan_ilmu_id").references(() => fanIlmu.id, {
      onDelete: "set null",
    }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    assignedBy: uuid("assigned_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("unique_mahasiswa_privilege").on(
      table.enrollmentId,
      table.classId,
      table.privilegeType
    ),
  ]
);

// Materials table (Course materials for tracking achievements)
export const materials = pgTable("materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  sequenceOrder: integer("sequence_order").notNull().default(0),
  materialType: materialTypeEnum("material_type").notNull().default("core"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Material Achievements table
export const materialAchievements = pgTable(
  "material_achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => classEnrollments.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    status: achievementStatusEnum("status").notNull().default("not_started"),
    score: decimal("score", { precision: 5, scale: 2 }),
    notes: text("notes"),
    achievedAt: timestamp("achieved_at", { withTimezone: true }),
    evaluatedBy: uuid("evaluated_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("unique_material_achievement").on(
      table.enrollmentId,
      table.materialId
    ),
  ]
);

// Hafalan Records table
export const hafalanRecords = pgTable("hafalan_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => classEnrollments.id, { onDelete: "cascade" }),
  fanIlmuId: uuid("fan_ilmu_id").references(() => fanIlmu.id, {
    onDelete: "set null",
  }),
  surahOrContent: text("surah_or_content").notNull(),
  ayatStart: integer("ayat_start"),
  ayatEnd: integer("ayat_end"),
  status: hafalanStatusEnum("status").notNull().default("pending"),
  score: decimal("score", { precision: 5, scale: 2 }),
  notes: text("notes"),
  evaluatedBy: uuid("evaluated_by").references(() => users.id),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Attendance Records table
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => classEnrollments.id, { onDelete: "cascade" }),
    attendanceDate: date("attendance_date").notNull(),
    status: attendanceStatusEnum("status").notNull().default("present"),
    notes: text("notes"),
    recordedBy: uuid("recorded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_attendance").on(
      table.enrollmentId,
      table.attendanceDate
    ),
  ]
);

// Evaluations table
export const evaluations = pgTable("evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => classEnrollments.id, { onDelete: "cascade" }),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  evaluationType: evaluationTypeEnum("evaluation_type").notNull(),
  score: decimal("score", { precision: 5, scale: 2 }),
  feedback: text("feedback"),
  evaluatedBy: uuid("evaluated_by")
    .notNull()
    .references(() => users.id),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Announcements table
export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================
// RELATIONS
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
  enrollments: many(classEnrollments),
  dosenPrivileges: many(dosenPrivileges),
  evaluationsGiven: many(evaluations),
  announcements: many(announcements),
}));

export const academicYearsRelations = relations(academicYears, ({ many }) => ({
  semesters: many(semesters),
}));

export const semestersRelations = relations(semesters, ({ one, many }) => ({
  academicYear: one(academicYears, {
    fields: [semesters.academicYearId],
    references: [academicYears.id],
  }),
  classes: many(classes),
  enrollments: many(classEnrollments),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  semester: one(semesters, {
    fields: [classes.semesterId],
    references: [semesters.id],
  }),
  enrollments: many(classEnrollments),
  groups: many(groups),
  fanIlmu: many(fanIlmu),
  dosenPrivileges: many(dosenPrivileges),
  mahasiswaPrivileges: many(mahasiswaPrivileges),
  materials: many(materials),
  evaluations: many(evaluations),
  announcements: many(announcements),
}));

export const classEnrollmentsRelations = relations(
  classEnrollments,
  ({ one, many }) => ({
    user: one(users, {
      fields: [classEnrollments.userId],
      references: [users.id],
    }),
    class: one(classes, {
      fields: [classEnrollments.classId],
      references: [classes.id],
    }),
    semester: one(semesters, {
      fields: [classEnrollments.semesterId],
      references: [semesters.id],
    }),
    groupMemberships: many(groupMembers),
    privileges: many(mahasiswaPrivileges),
    materialAchievements: many(materialAchievements),
    hafalanRecords: many(hafalanRecords),
    attendanceRecords: many(attendanceRecords),
    evaluations: many(evaluations),
  })
);

export const groupsRelations = relations(groups, ({ one, many }) => ({
  class: one(classes, {
    fields: [groups.classId],
    references: [classes.id],
  }),
  members: many(groupMembers),
  privileges: many(mahasiswaPrivileges),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  enrollment: one(classEnrollments, {
    fields: [groupMembers.enrollmentId],
    references: [classEnrollments.id],
  }),
}));

export const fanIlmuRelations = relations(fanIlmu, ({ one, many }) => ({
  class: one(classes, {
    fields: [fanIlmu.classId],
    references: [classes.id],
  }),
  privileges: many(mahasiswaPrivileges),
  hafalanRecords: many(hafalanRecords),
}));

export const dosenPrivilegesRelations = relations(
  dosenPrivileges,
  ({ one }) => ({
    user: one(users, {
      fields: [dosenPrivileges.userId],
      references: [users.id],
    }),
    class: one(classes, {
      fields: [dosenPrivileges.classId],
      references: [classes.id],
    }),
    assignedByUser: one(users, {
      fields: [dosenPrivileges.assignedBy],
      references: [users.id],
    }),
  })
);

export const mahasiswaPrivilegesRelations = relations(
  mahasiswaPrivileges,
  ({ one }) => ({
    enrollment: one(classEnrollments, {
      fields: [mahasiswaPrivileges.enrollmentId],
      references: [classEnrollments.id],
    }),
    class: one(classes, {
      fields: [mahasiswaPrivileges.classId],
      references: [classes.id],
    }),
    group: one(groups, {
      fields: [mahasiswaPrivileges.groupId],
      references: [groups.id],
    }),
    fanIlmu: one(fanIlmu, {
      fields: [mahasiswaPrivileges.fanIlmuId],
      references: [fanIlmu.id],
    }),
    assignedByUser: one(users, {
      fields: [mahasiswaPrivileges.assignedBy],
      references: [users.id],
    }),
  })
);

export const materialsRelations = relations(materials, ({ one, many }) => ({
  class: one(classes, {
    fields: [materials.classId],
    references: [classes.id],
  }),
  achievements: many(materialAchievements),
}));

export const materialAchievementsRelations = relations(
  materialAchievements,
  ({ one }) => ({
    enrollment: one(classEnrollments, {
      fields: [materialAchievements.enrollmentId],
      references: [classEnrollments.id],
    }),
    material: one(materials, {
      fields: [materialAchievements.materialId],
      references: [materials.id],
    }),
    evaluatedByUser: one(users, {
      fields: [materialAchievements.evaluatedBy],
      references: [users.id],
    }),
  })
);

export const hafalanRecordsRelations = relations(hafalanRecords, ({ one }) => ({
  enrollment: one(classEnrollments, {
    fields: [hafalanRecords.enrollmentId],
    references: [classEnrollments.id],
  }),
  fanIlmu: one(fanIlmu, {
    fields: [hafalanRecords.fanIlmuId],
    references: [fanIlmu.id],
  }),
  evaluatedByUser: one(users, {
    fields: [hafalanRecords.evaluatedBy],
    references: [users.id],
  }),
}));

export const attendanceRecordsRelations = relations(
  attendanceRecords,
  ({ one }) => ({
    enrollment: one(classEnrollments, {
      fields: [attendanceRecords.enrollmentId],
      references: [classEnrollments.id],
    }),
    recordedByUser: one(users, {
      fields: [attendanceRecords.recordedBy],
      references: [users.id],
    }),
  })
);

export const evaluationsRelations = relations(evaluations, ({ one }) => ({
  enrollment: one(classEnrollments, {
    fields: [evaluations.enrollmentId],
    references: [classEnrollments.id],
  }),
  class: one(classes, {
    fields: [evaluations.classId],
    references: [classes.id],
  }),
  evaluatedByUser: one(users, {
    fields: [evaluations.evaluatedBy],
    references: [users.id],
  }),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  class: one(classes, {
    fields: [announcements.classId],
    references: [classes.id],
  }),
  createdByUser: one(users, {
    fields: [announcements.createdBy],
    references: [users.id],
  }),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type AcademicYear = typeof academicYears.$inferSelect;
export type NewAcademicYear = typeof academicYears.$inferInsert;

export type Semester = typeof semesters.$inferSelect;
export type NewSemester = typeof semesters.$inferInsert;

export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;

export type ClassEnrollment = typeof classEnrollments.$inferSelect;
export type NewClassEnrollment = typeof classEnrollments.$inferInsert;

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;

export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;

export type FanIlmu = typeof fanIlmu.$inferSelect;
export type NewFanIlmu = typeof fanIlmu.$inferInsert;

export type DosenPrivilege = typeof dosenPrivileges.$inferSelect;
export type NewDosenPrivilege = typeof dosenPrivileges.$inferInsert;

export type MahasiswaPrivilege = typeof mahasiswaPrivileges.$inferSelect;
export type NewMahasiswaPrivilege = typeof mahasiswaPrivileges.$inferInsert;

export type Material = typeof materials.$inferSelect;
export type NewMaterial = typeof materials.$inferInsert;

export type MaterialAchievement = typeof materialAchievements.$inferSelect;
export type NewMaterialAchievement = typeof materialAchievements.$inferInsert;

export type HafalanRecord = typeof hafalanRecords.$inferSelect;
export type NewHafalanRecord = typeof hafalanRecords.$inferInsert;

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type NewAttendanceRecord = typeof attendanceRecords.$inferInsert;

export type Evaluation = typeof evaluations.$inferSelect;
export type NewEvaluation = typeof evaluations.$inferInsert;

export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
