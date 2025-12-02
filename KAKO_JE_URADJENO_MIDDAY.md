# Kako je urađeno kreiranje novog tima u Midday projektu

## 1. UI Komponente i Lokacije

### 1.1 TeamDropdown (Sidebar)
**Lokacija**: `apps/dashboard/src/components/team-dropdown.tsx`

**Kako funkcioniše**:
- Kada korisnik klikne na team avatar u sidebar-u, dropdown se aktivira
- Ako je dropdown aktiviran (`isActive === true`), prikazuje se **Plus dugme** (`Icons.Add`) iznad liste timova
- Plus dugme je animirano (koristi `framer-motion`) i pojavljuje se na vrhu liste
- Klik na Plus dugme vodi na `/teams/create`

**Kod**:
```tsx
{isActive && (
  <motion.div
    className="w-[32px] h-[32px] left-0 overflow-hidden absolute"
    style={{ zIndex: 1 }}
    initial={{ y: 0, opacity: 0 }}
    animate={{ y: -(32 + 10) * sortedTeams.length, opacity: 1 }}
    transition={{ type: "spring", stiffness: 400, damping: 25, mass: 1.2 }}
  >
    <Link href="/teams/create" onClick={() => setActive(false)}>
      <Button className="w-[32px] h-[32px] bg-background" size="icon" variant="outline">
        <Icons.Add />
      </Button>
    </Link>
  </motion.div>
)}
```

### 1.2 Teams Page (`/teams`)
**Lokacija**: `apps/dashboard/src/app/[locale]/(app)/teams/page.tsx`

**Kako funkcioniše**:
- Server-side stranica koja prikazuje listu timova i invite-a
- Ako korisnik nema timove i invite-e, automatski se redirect-uje na `/teams/create`
- Na dnu stranice postoji dugme "Create team" sa border-dashed separator-om i "Or" label-om

**Kod**:
```tsx
<div className="text-center mt-12 border-t-[1px] border-border pt-6 w-full relative border-dashed">
  <span className="absolute left-1/2 -translate-x-1/2 text-sm text-[#878787] bg-background -top-3 px-4">
    Or
  </span>
  <Link href="/teams/create" className="w-full">
    <Button className="w-full mt-2" variant="outline">
      Create team
    </Button>
  </Link>
</div>
```

### 1.3 Teams Table Header
**Lokacija**: `apps/dashboard/src/components/tables/teams/table-header.tsx`

**Kako funkcioniše**:
- U tabeli timova, pored search input-a postoji dugme "Create team"
- Link vodi na `/teams/create`

**Kod**:
```tsx
<Link href="/teams/create">
  <Button>Create team</Button>
</Link>
```

## 2. Create Team Page

### 2.1 Page Component
**Lokacija**: `apps/dashboard/src/app/[locale]/(app)/teams/create/page.tsx`

**Kako funkcioniše**:
- Server-side stranica sa header-om (logo) i centriranim formom
- Koristi `getCurrency()` i `getCountryCode()` za default vrednosti
- Prosleđuje promise-e ka `CreateTeamForm` komponenti

**Kod**:
```tsx
export default function CreateTeam() {
  const currency = getCurrency();
  const countryCode = getCountryCode();

  return (
    <>
      <header className="w-full absolute left-0 right-0 flex justify-between items-center">
        <div className="p-6">
          <Link href="/">
            <Icons.LogoSmall className="h-6 w-auto" />
          </Link>
        </div>
      </header>

      <div className="flex min-h-screen justify-center items-center overflow-hidden p-6 md:p-0">
        <div className="relative z-20 m-auto flex w-full max-w-[400px] flex-col">
          <div className="text-center">
            <h1 className="text-lg mb-2 font-serif">Setup your team</h1>
            <p className="text-[#878787] text-sm mb-8">
              Add your company name, country and currency. We'll use this to
              personalize your experience in Midday.
            </p>
          </div>

          <CreateTeamForm
            defaultCurrencyPromise={currency}
            defaultCountryCodePromise={countryCode}
          />
        </div>
      </div>
    </>
  );
}
```

## 3. CreateTeamForm Komponenta

### 3.1 Form Schema
**Lokacija**: `apps/dashboard/src/components/forms/create-team-form.tsx`

**Polja**:
```tsx
const formSchema = z.object({
  name: z.string().min(2, {
    message: "Team name must be at least 2 characters.",
  }),
  countryCode: z.string(),
  baseCurrency: z.string(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).nullable().optional(),
});
```

### 3.2 Form Fields

1. **Company name** (`name`)
   - Input polje sa placeholder-om "Ex: Acme Marketing or Acme Co"
   - Auto-focus na polje

2. **Country** (`countryCode`)
   - Koristi `CountrySelector` komponentu
   - Automatski postavlja default fiscal year na osnovu zemlje

3. **Base currency** (`baseCurrency`)
   - Koristi `SelectCurrency` komponentu
   - Prikazuje description: "If you have multiple accounts in different currencies, this will be the default currency for your company. You can change it later."

4. **Fiscal year starts** (`fiscalYearStartMonth`)
   - Koristi `SelectFiscalMonth` komponentu
   - Prikazuje description: "When does your company's fiscal year begin? This determines default date ranges for reports. You can change it later."

### 3.3 Form Logic

**Default Values**:
```tsx
const form = useZodForm(formSchema, {
  defaultValues: {
    name: "",
    baseCurrency: currency,
    countryCode: countryCode ?? "",
    fiscalYearStartMonth: getDefaultFiscalYearStartMonth(countryCode),
  },
});
```

**Auto-update Fiscal Year**:
```tsx
const selectedCountryCode = form.watch("countryCode");
useEffect(() => {
  const defaultFiscalYear = getDefaultFiscalYearStartMonth(selectedCountryCode);
  if (defaultFiscalYear !== form.getValues("fiscalYearStartMonth")) {
    form.setValue("fiscalYearStartMonth", defaultFiscalYear);
  }
}, [selectedCountryCode, form]);
```

**Form Lock** (sprečava duplo slanje):
```tsx
const [isLoading, setIsLoading] = useState(false);
const isSubmittedRef = useRef(false);
const isFormLocked = isLoading || isSubmittedRef.current;
```

### 3.4 Submit Handler

**Mutation**:
```tsx
const createTeamMutation = useMutation(
  trpc.team.create.mutationOptions({
    onSuccess: async (teamId) => {
      // Lock form permanently
      setIsLoading(true);
      isSubmittedRef.current = true;

      // Invalidate all queries
      await queryClient.invalidateQueries();

      // Revalidate server-side paths
      await revalidateAfterTeamChange();
    },
    onError: (error) => {
      setIsLoading(false);
      isSubmittedRef.current = false; // Reset on error to allow retry
    },
  }),
);
```

**Submit**:
```tsx
function onSubmit(values: FormValues) {
  if (isFormLocked) {
    return; // Block submission if form is locked
  }

  setIsLoading(true);
  isSubmittedRef.current = true;

  createTeamMutation.mutate({
    name: values.name,
    baseCurrency: values.baseCurrency,
    countryCode: values.countryCode,
    fiscalYearStartMonth: values.fiscalYearStartMonth,
    switchTeam: true, // Automatically switch to the new team
  });
}
```

## 4. Backend - tRPC Router

### 4.1 Team Router
**Lokacija**: `apps/api/src/trpc/routers/team.ts`

**Create Endpoint**:
```tsx
create: protectedProcedure
  .input(createTeamSchema)
  .mutation(async ({ ctx: { db, session }, input }) => {
    const teamId = await createTeam(db, {
      ...input,
      userId: session.user.id,
      email: session.user.email!,
    });

    return teamId;
  }),
```

**Schema**:
```tsx
export const createTeamSchema = z.object({
  name: z.string(),
  baseCurrency: z.string().optional(),
  countryCode: z.string().optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).nullable().optional(),
  switchTeam: z.boolean().optional(),
});
```

## 5. Database Query

### 5.1 createTeam Function
**Lokacija**: `packages/db/src/queries/teams.ts`

**Kako funkcioniše**:
1. **Transaction** - Sve se izvršava u jednoj transakciji (atomic)
2. **Check existing teams** - Proverava da li korisnik već ima timove
3. **Create team** - Kreira novi tim u `teams` tabeli
4. **Add user membership** - Dodaje korisnika u `usersOnTeam` sa rolom "owner"
5. **Create system categories** - Kreira sistemske kategorije za novi tim
6. **Switch team** (opciono) - Ako je `switchTeam: true`, ažurira `users.teamId`

**Kod**:
```tsx
export const createTeam = async (db: Database, params: CreateTeamParams) => {
  const teamId = await db.transaction(async (tx) => {
    // 1. Check existing teams
    const existingTeams = await tx
      .select({ id: teams.id, name: teams.name })
      .from(usersOnTeam)
      .innerJoin(teams, eq(teams.id, usersOnTeam.teamId))
      .where(eq(usersOnTeam.userId, params.userId));

    // 2. Create the team
    const [newTeam] = await tx
      .insert(teams)
      .values({
        name: params.name,
        baseCurrency: params.baseCurrency,
        countryCode: params.countryCode,
        fiscalYearStartMonth: params.fiscalYearStartMonth,
        logoUrl: params.logoUrl,
        email: params.email,
      })
      .returning({ id: teams.id });

    // 3. Add user to team membership
    await tx.insert(usersOnTeam).values({
      userId: params.userId,
      teamId: newTeam.id,
      role: "owner",
    });

    // 4. Create system categories
    await createSystemCategoriesForTeam(tx, newTeam.id, params.countryCode);

    // 5. Optionally switch user to the new team
    if (params.switchTeam) {
      await tx
        .update(users)
        .set({ teamId: newTeam.id })
        .where(eq(users.id, params.userId));
    }

    return newTeam.id;
  });

  return teamId;
};
```

### 5.2 Database Schema

**Teams Table**:
```tsx
export const teams = pgTable("teams", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  name: text(),
  logoUrl: text("logo_url"),
  inboxId: text("inbox_id").default("generate_inbox(10)"),
  email: text(),
  inboxEmail: text("inbox_email"),
  inboxForwarding: boolean("inbox_forwarding").default(true),
  baseCurrency: text("base_currency"),
  countryCode: text("country_code"),
  fiscalYearStartMonth: smallint("fiscal_year_start_month"),
  documentClassification: boolean("document_classification").default(false),
  flags: text().array(),
  canceledAt: timestamp("canceled_at", { withTimezone: true, mode: "string" }),
  plan: plansEnum().default("trial").notNull(),
  exportSettings: jsonb("export_settings"),
});
```

## 6. Flow Diagram

```
1. User clicks Plus button in TeamDropdown
   ↓
2. Navigate to /teams/create
   ↓
3. CreateTeam page loads with CreateTeamForm
   ↓
4. User fills form (name, country, currency, fiscal year)
   ↓
5. User clicks "Create" button
   ↓
6. Form submits → trpc.team.create mutation
   ↓
7. Backend: createTeam() function
   ├─ Transaction starts
   ├─ Create team record
   ├─ Add user as owner
   ├─ Create system categories
   └─ Switch user to new team (if switchTeam: true)
   ↓
8. Frontend: onSuccess callback
   ├─ Invalidate all queries
   ├─ Revalidate server-side paths
   └─ Redirect to home (automatic via revalidateAfterTeamChange)
```

## 7. Ključne Karakteristike

### 7.1 Atomic Operations
- Sve operacije se izvršavaju u jednoj transakciji
- Ako bilo koja operacija ne uspe, sve se rollback-uje

### 7.2 Form Lock
- Form se zaključava nakon uspešnog submit-a
- Sprečava duplo slanje
- Resetuje se samo na error

### 7.3 Auto Switch
- Ako je `switchTeam: true`, korisnik se automatski prebacuje na novi tim
- Ažurira se `users.teamId` u bazi

### 7.4 System Categories
- Automatski se kreiraju sistemske kategorije za novi tim
- Kategorije zavise od `countryCode`

### 7.5 Error Handling
- Detaljno logovanje svih operacija
- Sentry integracija za production errors
- User-friendly error messages

## 8. Razlike u odnosu na CRM projekt

| Aspekt | Midday | CRM |
|--------|--------|-----|
| **UI Pattern** | Full page route (`/teams/create`) | Sheet (slide-in panel) |
| **Form Fields** | name, countryCode, baseCurrency, fiscalYearStartMonth | name, industry, address, email, logoUrl... |
| **API** | tRPC (`trpc.team.create`) | REST API (`createCompany()`) |
| **Auto Switch** | Da (`switchTeam: true`) | Verovatno da |
| **System Categories** | Da (automatski) | Ne (ili drugačije) |
| **Form Lock** | Da (isSubmittedRef) | Ne (ili drugačije) |

## 9. Zaključak

Midday projekt koristi:
- **Full page approach** za kreiranje tima
- **tRPC** za type-safe API komunikaciju
- **Atomic transactions** za sigurnost podataka
- **Form lock** za sprečavanje duplog slanja
- **Auto switch** za bolje UX
- **System categories** za automatsko setup-ovanje

Sve ovo osigurava pouzdano i sigurno kreiranje novog tima sa svim potrebnim podacima i relacijama.

