"use client";

import * as React from "react";
import Link from "next/link";
import { MoreVertical, Eye, Pencil, LayoutGrid, Trash2, FileText, Calendar, Users } from "lucide-react";
import type { Project, User } from "@crm/types";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate, getInitials } from "@/lib/utils";

export type ProjectWithRelations = Project & {
  ownerName?: string;
  companyName?: string;
  taskCount?: number;
  teamMemberUsers?: User[];
};

interface ProjectCardProps {
  project: ProjectWithRelations;
  onDelete?: (project: ProjectWithRelations) => void;
}

const priorityColors = {
  high: "destructive",
  medium: "warning",
  low: "success",
} as const;

const categoryColors = {
  "saas": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  "website": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  "mobile": "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800",
  "default": "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800",
} as const;

function getProjectCategory(tags?: string[]): { label: string; color: string } {
  if (!tags || tags.length === 0) return { label: "Project", color: categoryColors.default };
  
  const lowerTags = tags.map(t => t.toLowerCase());
  
  if (lowerTags.some(t => t.includes("saas"))) {
    return { label: "SaaS Project", color: categoryColors.saas };
  }
  if (lowerTags.some(t => t.includes("website") || t.includes("web"))) {
    return { label: "Website", color: categoryColors.website };
  }
  if (lowerTags.some(t => t.includes("mobile") || t.includes("app"))) {
    return { label: "Mobile App", color: categoryColors.mobile };
  }
  
  return { label: tags[0], color: categoryColors.default };
}

function getProjectPriority(tags?: string[]): { label: string; variant: keyof typeof priorityColors } | null {
  if (!tags || tags.length === 0) return null;
  
  const lowerTags = tags.map(t => t.toLowerCase());
  
  if (lowerTags.includes("high") || lowerTags.includes("urgent")) {
    return { label: "High", variant: "high" };
  }
  if (lowerTags.includes("medium")) {
    return { label: "Medium", variant: "medium" };
  }
  if (lowerTags.includes("low")) {
    return { label: "Low", variant: "low" };
  }
  
  return null;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const category = getProjectCategory(project.tags);
  const priority = getProjectPriority(project.tags);
  const taskCount = project.taskCount || 0;
  const teamMembers = project.teamMemberUsers || [];
  const visibleMembers = teamMembers.slice(0, 3);
  const remainingCount = teamMembers.length - 3;

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-md hover:border-primary/20 py-0">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <Link 
              href={`/dashboard/projects/${project.id}`}
              className="font-semibold text-foreground hover:text-primary transition-colors truncate"
            >
              {project.name}
            </Link>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/projects/${project.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/projects/${project.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Project
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/kanban?projectId=${project.id}`}>
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  Kanban Board
                </Link>
              </DropdownMenuItem>
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(project)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${category.color}`}>
            <FileText className="h-3 w-3" />
            {category.label}
          </span>
          
          {taskCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <span className="text-amber-600 dark:text-amber-400">●</span>
              {taskCount} {taskCount === 1 ? "Task" : "Tasks"}
            </Badge>
          )}
          
          {priority && (
            <Badge variant={priorityColors[priority.variant]} className="gap-1">
              <span>●</span>
              {priority.label}
            </Badge>
          )}
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Dates */}
        <div className="space-y-2 mb-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Created Date</span>
            <span className="font-medium">{formatDate(project.createdAt)}</span>
          </div>
          {project.endDate && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {project.status === "completed" ? "Completion Date" : "Deadline"}
              </span>
              <span className={`font-medium ${
                project.status !== "completed" && new Date(project.endDate) < new Date() 
                  ? "text-destructive" 
                  : ""
              }`}>
                {formatDate(project.endDate)}
              </span>
            </div>
          )}
        </div>

        {/* Members */}
        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Members
          </span>
          <div className="flex items-center -space-x-2">
            {visibleMembers.map((member, index) => (
              <Avatar 
                key={member.id} 
                className="h-8 w-8 border-2 border-background"
                style={{ zIndex: visibleMembers.length - index }}
              >
                <AvatarImage src={member.avatarUrl || undefined} alt={`${member.firstName} ${member.lastName}`} />
                <AvatarFallback className="text-xs bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
                  {getInitials(`${member.firstName} ${member.lastName}`)}
                </AvatarFallback>
              </Avatar>
            ))}
            {remainingCount > 0 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">
                +{remainingCount}
              </div>
            )}
            {teamMembers.length === 0 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Users className="h-4 w-4" />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

