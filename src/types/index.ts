export * from './database.types';
export * from '../lib/academicTimeProfile';

export interface DashboardStats {
  totalCourses: number;
  schedulableCourses: number;
  totalLecturers: number;
  activeLecturers: number;
  totalRooms: number;
  totalOfferings: number;
  unconfirmedOfferings: number;
  totalConflicts: number;
  resolvedConflicts: number;
  publishedPercentage: number;
  scheduleStatus: string;
  availableRooms: number;
  totalStudents: number;
  activeTerm?: string;
}

export interface ReadinessItem {
  id: string;
  label: string;
  status: boolean;
  details: string;
}

export interface SchedulingReadiness {
  isReady: boolean;
  score: number;
  total: number;
  items: ReadinessItem[];
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
}
