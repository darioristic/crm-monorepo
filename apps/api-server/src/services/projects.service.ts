import type {
  ApiResponse,
  CreateMilestoneRequest,
  CreateProjectRequest,
  CreateTaskRequest,
  FilterParams,
  Milestone,
  PaginationParams,
  Project,
  Task,
  UpdateMilestoneRequest,
  UpdateProjectRequest,
  UpdateTaskRequest,
} from "@crm/types";
import {
  Errors,
  errorResponse,
  generateUUID,
  now,
  paginatedResponse,
  successResponse,
} from "@crm/utils";
import { cache } from "../cache/redis";
import { milestoneQueries, projectQueries, taskQueries } from "../db/queries";
import { serviceLogger } from "../lib/logger";

const CACHE_TTL = 300;

class ProjectsService {
  // ============================================
  // Project Operations
  // ============================================

  async getProjects(
    pagination: PaginationParams,
    filters: FilterParams
  ): Promise<ApiResponse<Project[]>> {
    try {
      const cacheKey = `projects:list:${JSON.stringify({ pagination, filters })}`;
      const cached = await cache.get<Project[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { data, total } = await projectQueries.findAll(pagination, filters);
      await cache.set(cacheKey, data, CACHE_TTL);

      return paginatedResponse(data, total, pagination);
    } catch (error) {
      serviceLogger.error(error, "Error fetching projects:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch projects");
    }
  }

  async getProjectById(id: string): Promise<ApiResponse<Project>> {
    try {
      const cacheKey = `projects:${id}`;
      const cached = await cache.get<Project>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const project = await projectQueries.findById(id);
      if (!project) {
        return Errors.NotFound("Project").toResponse();
      }

      await cache.set(cacheKey, project, CACHE_TTL);
      return successResponse(project);
    } catch (error) {
      serviceLogger.error(error, "Error fetching project:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch project");
    }
  }

  async createProject(data: CreateProjectRequest): Promise<ApiResponse<Project>> {
    try {
      if (!data.name || !data.managerId) {
        return errorResponse("VALIDATION_ERROR", "Name and managerId are required");
      }

      const project: Project = {
        id: generateUUID(),
        createdAt: now(),
        updatedAt: now(),
        ...data,
        status: data.status || "planning",
        teamMembers: data.teamMembers || [],
      };

      const created = await projectQueries.create(project);
      await cache.invalidatePattern("projects:list:*");

      return successResponse(created);
    } catch (error) {
      serviceLogger.error(error, "Error creating project:");
      return errorResponse("DATABASE_ERROR", "Failed to create project");
    }
  }

  async updateProject(id: string, data: UpdateProjectRequest): Promise<ApiResponse<Project>> {
    try {
      const existing = await projectQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Project").toResponse();
      }

      const updated = await projectQueries.update(id, {
        ...data,
        updatedAt: now(),
      });

      // Invalidate cache
      await cache.del(`projects:${id}`);
      await cache.invalidatePattern("projects:list:*");

      return successResponse(updated);
    } catch (error) {
      serviceLogger.error(error, "Error updating project:");
      return errorResponse("DATABASE_ERROR", "Failed to update project");
    }
  }

  async deleteProject(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const existing = await projectQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Project").toResponse();
      }

      await projectQueries.delete(id);

      // Invalidate cache
      await cache.del(`projects:${id}`);
      await cache.invalidatePattern("projects:list:*");

      return successResponse({ deleted: true });
    } catch (error) {
      serviceLogger.error(error, "Error deleting project:");
      return errorResponse("DATABASE_ERROR", "Failed to delete project");
    }
  }

  // ============================================
  // Task Operations
  // ============================================

  async getProjectTasks(
    projectId: string,
    pagination: PaginationParams
  ): Promise<ApiResponse<Task[]>> {
    try {
      const cacheKey = `projects:${projectId}:tasks:${JSON.stringify(pagination)}`;
      const cached = await cache.get<Task[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { data, total } = await taskQueries.findByProject(projectId, pagination);
      await cache.set(cacheKey, data, CACHE_TTL);

      return paginatedResponse(data, total, pagination);
    } catch (error) {
      serviceLogger.error(error, "Error fetching tasks:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch tasks");
    }
  }

  async getTaskById(id: string): Promise<ApiResponse<Task>> {
    try {
      const cacheKey = `tasks:${id}`;
      const cached = await cache.get<Task>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const task = await taskQueries.findById(id);
      if (!task) {
        return Errors.NotFound("Task").toResponse();
      }

      await cache.set(cacheKey, task, CACHE_TTL);
      return successResponse(task);
    } catch (error) {
      serviceLogger.error(error, "Error fetching task:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch task");
    }
  }

  async createTask(
    projectId: string,
    data: Omit<CreateTaskRequest, "projectId">
  ): Promise<ApiResponse<Task>> {
    try {
      // Verify project exists
      const project = await projectQueries.findById(projectId);
      if (!project) {
        return Errors.NotFound("Project").toResponse();
      }

      if (!data.title) {
        return errorResponse("VALIDATION_ERROR", "Title is required");
      }

      const task: Task = {
        id: generateUUID(),
        createdAt: now(),
        updatedAt: now(),
        projectId,
        ...data,
        status: data.status || "todo",
        priority: data.priority || "medium",
      };

      const created = await taskQueries.create(task);
      await cache.invalidatePattern(`projects:${projectId}:tasks:*`);

      return successResponse(created);
    } catch (error) {
      serviceLogger.error(error, "Error creating task:");
      return errorResponse("DATABASE_ERROR", "Failed to create task");
    }
  }

  async updateTask(id: string, data: UpdateTaskRequest): Promise<ApiResponse<Task>> {
    try {
      const existing = await taskQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Task").toResponse();
      }

      const updated = await taskQueries.update(id, {
        ...data,
        updatedAt: now(),
      });

      // Invalidate cache
      await cache.del(`tasks:${id}`);
      await cache.invalidatePattern(`projects:${existing.projectId}:tasks:*`);

      return successResponse(updated);
    } catch (error) {
      serviceLogger.error(error, "Error updating task:");
      return errorResponse("DATABASE_ERROR", "Failed to update task");
    }
  }

  async deleteTask(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const existing = await taskQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Task").toResponse();
      }

      await taskQueries.delete(id);

      // Invalidate cache
      await cache.del(`tasks:${id}`);
      await cache.invalidatePattern(`projects:${existing.projectId}:tasks:*`);
      await cache.invalidatePattern("tasks:list:*");

      return successResponse({ deleted: true });
    } catch (error) {
      serviceLogger.error(error, "Error deleting task:");
      return errorResponse("DATABASE_ERROR", "Failed to delete task");
    }
  }

  // Standalone task listing (all tasks with filters)
  async getTasks(
    pagination: PaginationParams,
    filters: FilterParams & { projectId?: string; milestoneId?: string; assignedTo?: string }
  ): Promise<ApiResponse<Task[]>> {
    try {
      const cacheKey = `tasks:list:${JSON.stringify({ pagination, filters })}`;
      const cached = await cache.get<Task[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { data, total } = await taskQueries.findAll(pagination, filters);
      await cache.set(cacheKey, data, CACHE_TTL);

      return paginatedResponse(data, total, pagination);
    } catch (error) {
      serviceLogger.error(error, "Error fetching tasks:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch tasks");
    }
  }

  // Standalone task creation
  async createTaskStandalone(data: CreateTaskRequest): Promise<ApiResponse<Task>> {
    try {
      // Verify project exists
      const project = await projectQueries.findById(data.projectId);
      if (!project) {
        return Errors.NotFound("Project").toResponse();
      }

      if (!data.title) {
        return errorResponse("VALIDATION_ERROR", "Title is required");
      }

      // Verify milestone if provided
      if (data.milestoneId) {
        const milestone = await milestoneQueries.findById(data.milestoneId);
        if (!milestone) {
          return errorResponse("VALIDATION_ERROR", "Milestone not found");
        }
        if (milestone.projectId !== data.projectId) {
          return errorResponse("VALIDATION_ERROR", "Milestone does not belong to the project");
        }
      }

      const task: Task = {
        id: generateUUID(),
        createdAt: now(),
        updatedAt: now(),
        ...data,
        status: data.status || "todo",
        priority: data.priority || "medium",
      };

      const created = await taskQueries.create(task);
      await cache.invalidatePattern(`projects:${data.projectId}:tasks:*`);
      await cache.invalidatePattern("tasks:list:*");

      return successResponse(created);
    } catch (error) {
      serviceLogger.error(error, "Error creating task:");
      return errorResponse("DATABASE_ERROR", "Failed to create task");
    }
  }

  // ============================================
  // Milestone Operations
  // ============================================

  async getMilestones(
    pagination: PaginationParams,
    filters: FilterParams & { projectId?: string }
  ): Promise<ApiResponse<Milestone[]>> {
    try {
      const cacheKey = `milestones:list:${JSON.stringify({ pagination, filters })}`;
      const cached = await cache.get<Milestone[]>(cacheKey);
      if (cached) {
        return paginatedResponse(cached, cached.length, pagination);
      }

      const { data, total } = await milestoneQueries.findAll(pagination, filters);
      await cache.set(cacheKey, data, CACHE_TTL);

      return paginatedResponse(data, total, pagination);
    } catch (error) {
      serviceLogger.error(error, "Error fetching milestones:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch milestones");
    }
  }

  async getMilestoneById(id: string): Promise<ApiResponse<Milestone>> {
    try {
      const cacheKey = `milestones:${id}`;
      const cached = await cache.get<Milestone>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const milestone = await milestoneQueries.findById(id);
      if (!milestone) {
        return Errors.NotFound("Milestone").toResponse();
      }

      await cache.set(cacheKey, milestone, CACHE_TTL);
      return successResponse(milestone);
    } catch (error) {
      serviceLogger.error(error, "Error fetching milestone:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch milestone");
    }
  }

  async createMilestone(data: CreateMilestoneRequest): Promise<ApiResponse<Milestone>> {
    try {
      // Verify project exists
      const project = await projectQueries.findById(data.projectId);
      if (!project) {
        return Errors.NotFound("Project").toResponse();
      }

      if (!data.name || !data.dueDate) {
        return errorResponse("VALIDATION_ERROR", "Name and dueDate are required");
      }

      const milestone: Milestone = {
        id: generateUUID(),
        createdAt: now(),
        updatedAt: now(),
        ...data,
        status: data.status || "pending",
        order: 0, // Will be set by the query
      };

      const created = await milestoneQueries.create(milestone);

      // Invalidate cache
      await cache.invalidatePattern("milestones:list:*");
      await cache.invalidatePattern(`projects:${data.projectId}:milestones:*`);

      return successResponse(created);
    } catch (error) {
      serviceLogger.error(error, "Error creating milestone:");
      return errorResponse("DATABASE_ERROR", "Failed to create milestone");
    }
  }

  async updateMilestone(id: string, data: UpdateMilestoneRequest): Promise<ApiResponse<Milestone>> {
    try {
      const existing = await milestoneQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Milestone").toResponse();
      }

      const updated = await milestoneQueries.update(id, {
        ...data,
      });

      // Invalidate cache
      await cache.del(`milestones:${id}`);
      await cache.invalidatePattern("milestones:list:*");
      await cache.invalidatePattern(`projects:${existing.projectId}:milestones:*`);

      return successResponse(updated);
    } catch (error) {
      serviceLogger.error(error, "Error updating milestone:");
      return errorResponse("DATABASE_ERROR", "Failed to update milestone");
    }
  }

  async deleteMilestone(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const existing = await milestoneQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Milestone").toResponse();
      }

      await milestoneQueries.delete(id);

      // Invalidate cache
      await cache.del(`milestones:${id}`);
      await cache.invalidatePattern("milestones:list:*");
      await cache.invalidatePattern(`projects:${existing.projectId}:milestones:*`);
      // Also invalidate task caches since tasks reference milestones
      await cache.invalidatePattern("tasks:list:*");

      return successResponse({ deleted: true });
    } catch (error) {
      serviceLogger.error(error, "Error deleting milestone:");
      return errorResponse("DATABASE_ERROR", "Failed to delete milestone");
    }
  }

  async getProjectMilestones(projectId: string): Promise<ApiResponse<Milestone[]>> {
    try {
      const cacheKey = `projects:${projectId}:milestones`;
      const cached = await cache.get<Milestone[]>(cacheKey);
      if (cached) {
        return successResponse(cached);
      }

      const milestones = await milestoneQueries.findByProject(projectId);
      await cache.set(cacheKey, milestones, CACHE_TTL);

      return successResponse(milestones);
    } catch (error) {
      serviceLogger.error(error, "Error fetching project milestones:");
      return errorResponse("DATABASE_ERROR", "Failed to fetch project milestones");
    }
  }

  async markMilestoneCompleted(id: string): Promise<ApiResponse<Milestone>> {
    try {
      const existing = await milestoneQueries.findById(id);
      if (!existing) {
        return Errors.NotFound("Milestone").toResponse();
      }

      const updated = await milestoneQueries.markCompleted(id);

      // Invalidate cache
      await cache.del(`milestones:${id}`);
      await cache.invalidatePattern("milestones:list:*");
      await cache.invalidatePattern(`projects:${existing.projectId}:milestones:*`);

      return successResponse(updated);
    } catch (error) {
      serviceLogger.error(error, "Error completing milestone:");
      return errorResponse("DATABASE_ERROR", "Failed to complete milestone");
    }
  }
}

export const projectsService = new ProjectsService();
