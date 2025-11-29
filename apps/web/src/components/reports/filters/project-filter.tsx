"use client";

import { useEffect, useState } from "react";
import { FolderIcon, XIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { projectsApi } from "@/lib/api";
import type { Project } from "@crm/types";

interface ProjectFilterProps {
  value?: string;
  onChange: (projectId: string | undefined) => void;
  className?: string;
}

export function ProjectFilter({ value, onChange, className }: ProjectFilterProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        const response = await projectsApi.getAll({ pageSize: 100 });
        if (response.success && response.data) {
          setProjects(response.data);
        }
      } catch (error) {
        console.error("Failed to load projects:", error);
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, []);

  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <Select
          value={value || "all"}
          onValueChange={(v) => onChange(v === "all" ? undefined : v)}
          disabled={loading}
        >
          <SelectTrigger className="w-[200px]">
            <FolderIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onChange(undefined)}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

