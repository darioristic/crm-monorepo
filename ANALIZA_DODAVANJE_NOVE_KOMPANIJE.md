# Analiza: Dodavanje nove kompanije/tima

## 1. Midday Projekt - Kako funkcioniše

### 1.1 Lokacije gde se može dodati novi tim

#### A. TeamDropdown (Sidebar)
- **Lokacija**: `apps/dashboard/src/components/team-dropdown.tsx`
- **Prikaz**: Kada je dropdown aktiviran (hover ili klik), prikazuje se Plus dugme (`Icons.Add`) iznad liste timova
- **Akcija**: Link ka `/teams/create`
- **Kod**:
  ```tsx
  {isActive && (
    <Link href="/teams/create" onClick={() => setActive(false)}>
      <Button className="w-[32px] h-[32px] bg-background" size="icon" variant="outline">
        <Icons.Add />
      </Button>
    </Link>
  )}
  ```

#### B. Teams Page (`/teams`)
- **Lokacija**: `apps/dashboard/src/app/[locale]/(app)/teams/page.tsx`
- **Prikaz**: Dugme "Create team" na dnu stranice, ispod liste timova i invite-a
- **Akcija**: Link ka `/teams/create`
- **Kod**:
  ```tsx
  <Link href="/teams/create" className="w-full">
    <Button className="w-full mt-2" variant="outline">
      Create team
    </Button>
  </Link>
  ```

#### C. Teams Table Header
- **Lokacija**: `apps/dashboard/src/components/tables/teams/table-header.tsx`
- **Prikaz**: Dugme "Create team" pored search input-a
- **Akcija**: Link ka `/teams/create`
- **Kod**:
  ```tsx
  <Link href="/teams/create">
    <Button>Create team</Button>
  </Link>
  ```

### 1.2 Create Team Page

- **Lokacija**: `apps/dashboard/src/app/[locale]/(app)/teams/create/page.tsx`
- **Komponenta**: `CreateTeamForm`
- **Polja forme**:
  - `name` (string, min 2 karaktera)
  - `countryCode` (string)
  - `baseCurrency` (string)
  - `fiscalYearStartMonth` (number, 1-12, nullable, optional)
- **API poziv**: `trpc.team.create.mutationOptions()`
- **Nakon kreiranja**: Automatski se prebacuje na novi tim (`switchTeam: true`)

### 1.3 CreateTeamForm

- **Lokacija**: `apps/dashboard/src/components/forms/create-team-form.tsx`
- **Funkcionalnosti**:
  - Validacija sa Zod schema
  - Default vrednosti za currency i country code
  - Automatsko prebacivanje na novi tim nakon kreiranja
  - Form lock nakon uspešnog submit-a (sprečava duplo slanje)
  - Optimistic updates sa React Query

## 2. Trenutni Projekt (CRM) - Kako funkcioniše

### 2.1 Lokacije gde se može dodati nova kompanija

#### A. CompanyDropdown (Sidebar)
- **Lokacija**: `apps/web/src/components/company-dropdown.tsx`
- **Prikaz**: Plus dugme se prikazuje kada je dropdown aktiviran
- **Akcija**: Link ka `/dashboard/companies/create`
- **Kod**:
  ```tsx
  {isActive && (
    <Link href="/dashboard/companies/create" onClick={() => setActive(false)}>
      <Button className="h-8 w-8 rounded-md" size="icon" variant="outline">
        <Plus className="h-4 w-4" />
      </Button>
    </Link>
  )}
  ```

#### B. Companies Page (`/dashboard/companies`)
- **Lokacija**: `apps/web/src/app/dashboard/companies/page.tsx`
- **Prikaz**: "Add Company" dugme u header-u
- **Akcija**: Otvara `CompanyCreateSheet` preko URL params (`createCompany=true`)
- **Kod**:
  ```tsx
  <Button onClick={() => setParams({ createCompany: true })}>
    <PlusCircledIcon className="mr-2 h-4 w-4" />
    Add Company
  </Button>
  ```

#### C. SelectCompany Component
- **Lokacija**: `apps/web/src/components/companies/select-company.tsx`
- **Prikaz**: "Create new company" opcija u dropdown-u
- **Akcija**: Otvara `CompanyCreateSheet` preko URL params

### 2.2 Company Create Sheet

- **Lokacija**: `apps/web/src/components/companies/company-create-sheet.tsx`
- **Komponenta**: `CompanyForm`
- **Tip**: Sheet (slide-in panel) umesto full page
- **Trigger**: URL params (`createCompany=true`)

### 2.3 CompanyForm

- **Lokacija**: `apps/web/src/components/companies/company-form.tsx`
- **API poziv**: `createCompany()` iz `@/lib/companies`
- **Polja**: Verovatno `name`, `industry`, `address`, `email`, `logoUrl`

## 3. Razlike između Midday i CRM projekta

| Aspekt | Midday | CRM |
|--------|--------|-----|
| **UI Pattern** | Full page (`/teams/create`) | Sheet (slide-in panel) |
| **Lokacije** | 3 mesta (dropdown, teams page, table header) | 3 mesta (dropdown, companies page, select component) |
| **Routing** | Dedicated route | URL params + sheet |
| **Form Fields** | name, countryCode, baseCurrency, fiscalYearStartMonth | name, industry, address, email, logoUrl |
| **API** | tRPC (`trpc.team.create`) | REST API (`createCompany()`) |
| **Auto Switch** | Da (`switchTeam: true`) | Verovatno da |

## 4. Šta nedostaje u Settings sekciji

### 4.1 Trenutno stanje Settings sekcije

- **General Settings** (`/dashboard/settings`): CompanyLogo, CompanyName, CompanyEmail, CompanyCountry, BaseCurrency, CompanyFiscalYear, DeleteTeam
- **Members** (`/dashboard/settings/members`): TeamMembers komponenta sa tabelom
- **Nedostaje**: Opcija za kreiranje nove kompanije/tima

### 4.2 Gde bi trebalo dodati opciju

#### Opcija 1: U Settings Layout (SecondaryMenu)
- Dodati link "Create Company" u SecondaryMenu
- **Prednosti**: Lako dostupno, konzistentno sa ostalim opcijama
- **Mane**: Možda nije najlogičnije mesto (Settings je za postavke, ne za kreiranje)

#### Opcija 2: U General Settings page
- Dodati card/sekciju "Create New Company" na dnu General Settings stranice
- **Prednosti**: Logično mesto, vidljivo na glavnoj settings stranici
- **Mane**: Može biti previše istaknuto

#### Opcija 3: U Members page
- Dodati dugme "Create Company" u Members tabelu header
- **Prednosti**: Konzistentno sa Teams page u Midday projektu
- **Mane**: Možda nije najlogičnije mesto

#### Opcija 4: Kombinacija
- Dodati u General Settings page kao sekciju
- Dodati u Members page kao dugme u header-u
- **Prednosti**: Više opcija za pristup
- **Mane**: Može biti redundantno

## 5. Preporučeno rešenje

### 5.1 Predlog implementacije

**Opcija A: General Settings Page (Preporučeno)**
- Dodati novu Card sekciju na dnu General Settings stranice
- Naslov: "Create New Company"
- Opis: "Create a new company to organize your work separately"
- Dugme: "Create Company" koje otvara `CompanyCreateSheet`

**Opcija B: Members Page Header**
- Dodati "Create Company" dugme u Members tabelu header (pored "Invite member")
- Konzistentno sa Teams page u Midday projektu

**Opcija C: Obe opcije**
- Implementirati obe opcije za maksimalnu dostupnost

### 5.2 Komponente koje treba kreirati/adaptirati

1. **CreateCompanyCard** (opciono)
   - Card komponenta za General Settings page
   - Wrapper oko CompanyCreateSheet logike

2. **CompanyCreateSheet** (već postoji)
   - Može se koristiti direktno
   - Treba proveriti da li podržava sve potrebne polja

3. **CompanyForm** (već postoji)
   - Treba proveriti da li ima sva polja kao u Midday projektu
   - Možda treba dodati: `countryCode`, `baseCurrency`, `fiscalYearStartMonth`

### 5.3 API adaptacija

- **Midday**: `trpc.team.create` sa poljima: `name`, `countryCode`, `baseCurrency`, `fiscalYearStartMonth`, `switchTeam`
- **CRM**: `createCompany()` sa poljima: `name`, `industry`, `address`, `email`, `logoUrl`, `switchCompany`
- **Potrebno**: Proveriti da li `createCompany` podržava `countryCode`, `baseCurrency`, `fiscalYearStartMonth`

## 6. Plan implementacije

### Faza 1: Analiza postojećeg
- [x] Analizirati Midday implementaciju
- [x] Analizirati CRM implementaciju
- [ ] Proveriti CompanyForm polja
- [ ] Proveriti createCompany API endpoint

### Faza 2: Implementacija
- [ ] Dodati "Create Company" sekciju u General Settings page
- [ ] Dodati "Create Company" dugme u Members page header
- [ ] Adaptirati CompanyForm ako je potrebno
- [ ] Testirati funkcionalnost

### Faza 3: Validacija
- [ ] Testirati kreiranje nove kompanije
- [ ] Testirati automatsko prebacivanje na novu kompaniju
- [ ] Testirati refresh podataka nakon kreiranja

## 7. Zaključak

Trenutno u Settings sekciji **nedostaje opcija za kreiranje nove kompanije**. Preporučeno je dodati:

1. **Card sekciju u General Settings page** - za jasnu vidljivost
2. **Dugme u Members page header** - za konzistentnost sa Midday projektom

Obe opcije bi trebalo da koriste postojeći `CompanyCreateSheet` i `CompanyForm` komponente, uz eventualne adaptacije za dodatna polja ako je potrebno.

