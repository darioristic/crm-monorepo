export interface Category {
  id: string;
  name: string;
  slug: string;
  color?: string;
  icon?: string;
  parentId?: string;
}

export interface CategoryWithEmbedding extends Category {
  embedding: number[];
  embeddingModel: string;
}

export interface CategoryMatch {
  category: Category;
  similarity: number;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

export interface EmbeddingsResult {
  embeddings: number[][];
  model: string;
}

