/**
 * Task Components
 *
 * Reusable React components for the polymorphic entity task system.
 * These components support tasks for projects, customers, employees,
 * vendors, leads, prospects, and contacts.
 *
 * @example
 * // Basic task list for a project
 * import { TaskList } from '@/components/tasks';
 *
 * <TaskList entityType="project" entityId={projectId} />
 *
 * @example
 * // Task card with handlers
 * import { TaskCard, TaskStatusBadge, TaskPriorityBadge } from '@/components/tasks';
 *
 * <TaskCard
 *   task={task}
 *   onStatusChange={(id, status) => handleStatusChange(id, status)}
 *   onEdit={(task) => openEditDialog(task)}
 * />
 */

export { TaskList } from './TaskList';
export { TaskCard } from './TaskCard';
export { TaskForm } from './TaskForm';
export { TaskDetail } from './TaskDetail';
export { TaskStatusBadge, type TaskStatus } from './TaskStatusBadge';
export { TaskPriorityBadge, type TaskPriority } from './TaskPriorityBadge';
