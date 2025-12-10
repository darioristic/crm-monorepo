export interface LocationMetadata {
  [key: string]: unknown;
}

export class Location {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly name: string,
    public readonly code: string | null,
    public readonly metadata: LocationMetadata | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static create(
    tenantId: string,
    name: string,
    code?: string,
    metadata?: LocationMetadata
  ): Location {
    const now = new Date();
    return new Location(
      crypto.randomUUID(),
      tenantId,
      name,
      code || null,
      metadata || null,
      now,
      now
    );
  }

  updateName(name: string): Location {
    return new Location(
      this.id,
      this.tenantId,
      name,
      this.code,
      this.metadata,
      this.createdAt,
      new Date()
    );
  }

  updateCode(code: string): Location {
    return new Location(
      this.id,
      this.tenantId,
      this.name,
      code,
      this.metadata,
      this.createdAt,
      new Date()
    );
  }
}
