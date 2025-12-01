"use client";

import { VaultSelectTags, type TagOption } from "@/components/vault/vault-select-tags";
import { documentTagAssignmentsApi } from "@/lib/api";
import type { DocumentWithTags } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type TagAssignment = NonNullable<
	DocumentWithTags["documentTagAssignments"]
>[number];

interface Props {
	id: string;
	tags?: TagAssignment[];
}

export function DocumentTags({ id, tags }: Props) {
	const queryClient = useQueryClient();

	const createAssignmentMutation = useMutation({
		mutationFn: (tagId: string) =>
			documentTagAssignmentsApi.assign({ documentId: id, tagId }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["documents"] });
		},
	});

	const deleteAssignmentMutation = useMutation({
		mutationFn: (tagId: string) =>
			documentTagAssignmentsApi.remove({ documentId: id, tagId }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["documents"] });
		},
	});

	const currentTags: TagOption[] =
		tags?.map((tag) => ({
			id: tag.documentTag.id,
			value: tag.documentTag.id,
			label: tag.documentTag.name,
		})) ?? [];

	return (
		<VaultSelectTags
			tags={currentTags}
			onSelect={(tag) => {
				if (tag.id) {
					createAssignmentMutation.mutate(tag.id);
				}
			}}
			onRemove={(tag) => {
				deleteAssignmentMutation.mutate(tag.id);
			}}
		/>
	);
}

