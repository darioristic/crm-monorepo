/**
 * Projects Routes - Projects, Milestones, Tasks
 */

import { errorResponse } from "@crm/utils";
import { projectsService } from "../services/projects.service";
import { RouteBuilder, withAuth, parseBody, parsePagination, parseFilters } from "./helpers";
import type {
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  CreateMilestoneRequest,
  UpdateMilestoneRequest,
} from "@crm/types";

const router = new RouteBuilder();

// ============================================
// PROJECTS
// ============================================

router.get("/api/v1/projects", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return projectsService.getProjects(pagination, filters);
  });
});

router.get("/api/v1/projects/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return projectsService.getProjectById(params.id);
  });
});

router.post("/api/v1/projects", async (request) => {
  return withAuth(
    request,
    async () => {
      const body = await parseBody<CreateProjectRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return projectsService.createProject(body);
    },
    201
  );
});

router.put("/api/v1/projects/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateProjectRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return projectsService.updateProject(params.id, body);
  });
});

router.patch("/api/v1/projects/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateProjectRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return projectsService.updateProject(params.id, body);
  });
});

router.delete("/api/v1/projects/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return projectsService.deleteProject(params.id);
  });
});

router.get("/api/v1/projects/:id/tasks", async (request, url, params) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    return projectsService.getProjectTasks(params.id, pagination);
  });
});

router.get("/api/v1/projects/:id/milestones", async (request, _url, params) => {
  return withAuth(request, async () => {
    return projectsService.getProjectMilestones(params.id);
  });
});

// ============================================
// MILESTONES
// ============================================

router.get("/api/v1/milestones", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return projectsService.getMilestones(pagination, filters);
  });
});

router.get("/api/v1/milestones/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return projectsService.getMilestoneById(params.id);
  });
});

router.post("/api/v1/milestones", async (request) => {
  return withAuth(
    request,
    async () => {
      const body = await parseBody<CreateMilestoneRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return projectsService.createMilestone(body);
    },
    201
  );
});

router.put("/api/v1/milestones/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateMilestoneRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return projectsService.updateMilestone(params.id, body);
  });
});

router.patch("/api/v1/milestones/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateMilestoneRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return projectsService.updateMilestone(params.id, body);
  });
});

router.delete("/api/v1/milestones/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return projectsService.deleteMilestone(params.id);
  });
});

router.post("/api/v1/milestones/:id/complete", async (request, _url, params) => {
  return withAuth(request, async () => {
    return projectsService.markMilestoneCompleted(params.id);
  });
});

// ============================================
// TASKS
// ============================================

router.get("/api/v1/tasks", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return projectsService.getTasks(pagination, filters);
  });
});

router.get("/api/v1/tasks/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return projectsService.getTaskById(params.id);
  });
});

router.post("/api/v1/tasks", async (request) => {
  return withAuth(
    request,
    async () => {
      const body = await parseBody<CreateTaskRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return projectsService.createTaskStandalone(body);
    },
    201
  );
});

router.put("/api/v1/tasks/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateTaskRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return projectsService.updateTask(params.id, body);
  });
});

router.patch("/api/v1/tasks/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateTaskRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return projectsService.updateTask(params.id, body);
  });
});

router.delete("/api/v1/tasks/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return projectsService.deleteTask(params.id);
  });
});

export const projectRoutes = router.getRoutes();
