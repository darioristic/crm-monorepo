import { ProjectForm } from "@/components/projects/project-form";
import { generateMeta } from "@/lib/utils";

export async function generateMetadata() {
  return generateMeta({
    title: "New Project",
    description: "Create a new project",
    canonical: "/dashboard/projects/new",
  });
}

export default function NewProjectPage() {
  return (
    <div className="max-w-3xl">
      <ProjectForm mode="create" />
    </div>
  );
}
