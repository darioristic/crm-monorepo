export interface CompanyMetadata {
  [key: string]: unknown;
}

export class Company {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly locationId: string | null,
    public readonly name: string,
    public readonly industry: string,
    public readonly address: string,
    public readonly email: string | null,
    public readonly phone: string | null,
    public readonly website: string | null,
    public readonly contact: string | null,
    public readonly city: string | null,
    public readonly zip: string | null,
    public readonly country: string | null,
    public readonly countryCode: string | null,
    public readonly vatNumber: string | null,
    public readonly companyNumber: string | null,
    public readonly logoUrl: string | null,
    public readonly note: string | null,
    public readonly metadata: CompanyMetadata | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static create(
    tenantId: string,
    name: string,
    industry: string,
    address: string,
    locationId?: string,
    metadata?: CompanyMetadata
  ): Company {
    const now = new Date();
    return new Company(
      crypto.randomUUID(),
      tenantId,
      locationId || null,
      name,
      industry,
      address,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      metadata || null,
      now,
      now
    );
  }

  belongsToTenant(tenantId: string): boolean {
    return this.tenantId === tenantId;
  }

  updateLocation(locationId: string | null): Company {
    return new Company(
      this.id,
      this.tenantId,
      locationId,
      this.name,
      this.industry,
      this.address,
      this.email,
      this.phone,
      this.website,
      this.contact,
      this.city,
      this.zip,
      this.country,
      this.countryCode,
      this.vatNumber,
      this.companyNumber,
      this.logoUrl,
      this.note,
      this.metadata,
      this.createdAt,
      new Date()
    );
  }
}
