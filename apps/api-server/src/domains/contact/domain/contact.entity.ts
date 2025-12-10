export class Contact {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly companyId: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly email: string,
    public readonly phone: string | null,
    public readonly company: string | null,
    public readonly position: string | null,
    public readonly street: string | null,
    public readonly city: string | null,
    public readonly state: string | null,
    public readonly postalCode: string | null,
    public readonly country: string | null,
    public readonly notes: string | null,
    public readonly leadId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static create(
    tenantId: string,
    companyId: string,
    firstName: string,
    lastName: string,
    email: string
  ): Contact {
    const now = new Date();
    return new Contact(
      crypto.randomUUID(),
      tenantId,
      companyId,
      firstName,
      lastName,
      email,
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
      now,
      now
    );
  }

  belongsToTenant(tenantId: string): boolean {
    return this.tenantId === tenantId;
  }

  belongsToCompany(companyId: string): boolean {
    return this.companyId === companyId;
  }

  belongsToTenantAndCompany(tenantId: string, companyId: string): boolean {
    return this.tenantId === tenantId && this.companyId === companyId;
  }

  getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
