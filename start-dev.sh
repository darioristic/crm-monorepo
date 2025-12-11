#!/bin/bash

# ============================================
# CRM Monorepo - Interactive Development Startup
# ============================================

set +e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Navigate to project root
cd "$(dirname "$0")"
PROJECT_ROOT=$(pwd)

# ============================================
# Functions
# ============================================

print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║     ██████╗██████╗ ███╗   ███╗                               ║"
    echo "║    ██╔════╝██╔══██╗████╗ ████║                               ║"
    echo "║    ██║     ██████╔╝██╔████╔██║                               ║"
    echo "║    ██║     ██╔══██╗██║╚██╔╝██║                               ║"
    echo "║    ╚██████╗██║  ██║██║ ╚═╝ ██║                               ║"
    echo "║     ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝                               ║"
    echo "║                                                               ║"
    echo "║          Interactive Development Environment                  ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_seed_info() {
    echo -e "${MAGENTA}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                    📊 SEED DATA INFO                          ║"
    echo "╠═══════════════════════════════════════════════════════════════╣"
    echo "║                                                               ║"
    echo "║  Tenanti:                                                     ║"
    echo "║    • Cloud Native d.o.o. (prefix: CN)                         ║"
    echo "║    • Softergee d.o.o. (prefix: SG)                            ║"
    echo "║                                                               ║"
    echo "║  Admin korisnici (za oba tenanta):                            ║"
    echo "║    • dario@crm.local                                          ║"
    echo "║    • miha@crm.local                                           ║"
    echo "║    • tara@crm.local                                           ║"
    echo "║    Password: changeme123                                      ║"
    echo "║                                                               ║"
    echo "║  Podaci PO TENANTU:                                           ║"
    echo "║    • 25 Customer kompanija (srpske firme)                     ║"
    echo "║    • 50 Kontakata                                             ║"
    echo "║    • 25 Leadova                                               ║"
    echo "║    • 25 Dealova                                               ║"
    echo "║    • 25 Ponuda (Quotes)                                       ║"
    echo "║    • 25 Faktura (Invoices)                                    ║"
    echo "║    • 25 Narudzbina (Orders)                                   ║"
    echo "║    • 25 Otpremnica (Delivery Notes)                           ║"
    echo "║    • 25 Uplata (Payments)                                     ║"
    echo "║    • 25 Projekata                                             ║"
    echo "║    • 25 Milestone-a                                           ║"
    echo "║    • 50 Taskova                                               ║"
    echo "║    • 30 Notifikacija                                          ║"
    echo "║    • 50 Aktivnosti                                            ║"
    echo "║    • 10 Bankovnih racuna                                      ║"
    echo "║    • 30 Dokumenata                                            ║"
    echo "║    • 25 Proizvoda (5 kategorija)                              ║"
    echo "║                                                               ║"
    echo "║  Srpske kompanije:                                            ║"
    echo "║    NIS, Telekom Srbija, Delta Holding, MK Group,              ║"
    echo "║    Hemofarm, Telenor, Imlek, Komercijalna Banka...            ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

ask_for_seed() {
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  Da li zelis da seedujes sve podatke u bazu?${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  ${CYAN}[1]${NC} Da - Seeduj kompletne podatke (preporuceno za prvi put)"
    echo -e "  ${CYAN}[2]${NC} Ne - Pokreni bez seedovanja"
    echo -e "  ${CYAN}[3]${NC} Info - Prikazi sta ce biti seedovano"
    echo ""
    read -p "  Tvoj izbor [1/2/3]: " choice

    case $choice in
        1|y|Y|da|Da|DA)
            return 0
            ;;
        3|i|I|info|Info|INFO)
            print_seed_info
            ask_for_seed
            return $?
            ;;
        *)
            return 1
            ;;
    esac
}

run_migrations() {
    echo -e "${BLUE}🔄 Pokrecem migracije...${NC}"
    cd "$PROJECT_ROOT/apps/api-server"
    if bun run migrate:up; then
        echo -e "${GREEN}✓ Migracije zavrsene${NC}"
    else
        echo -e "${YELLOW}⚠ Migracije mozda vec postoje${NC}"
    fi
    cd "$PROJECT_ROOT"
}

run_complete_seed() {
    echo ""
    echo -e "${BLUE}🌱 Pokrecem kompletno seedovanje...${NC}"
    echo -e "${YELLOW}   Ovo moze potrajati 1-2 minuta...${NC}"
    echo ""

    cd "$PROJECT_ROOT/apps/api-server"

    if bun run db:seed-complete; then
        echo ""
        echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║            ✅ SEEDOVANJE USPESNO ZAVRSENO!                    ║${NC}"
        echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}❌ Seedovanje nije uspelo${NC}"
        return 1
    fi

    cd "$PROJECT_ROOT"
}

start_dev_environment() {
    echo ""
    echo -e "${BLUE}🚀 Pokrecem development okruzenje...${NC}"
    echo ""

    # Use the existing dev.sh script
    bash "$PROJECT_ROOT/scripts/dev.sh"
}

# ============================================
# Main Script
# ============================================

clear
print_banner

echo -e "${BLUE}📁 Projekat: $PROJECT_ROOT${NC}"
echo ""

# Check if this is potentially a fresh setup (no data)
echo -e "${BLUE}🔍 Proveravam stanje baze...${NC}"

# First, ensure Docker is running and start services
echo -e "${BLUE}🐳 Proveravam Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}Docker nije pokrenut. Pokrecem Docker Desktop...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open -a Docker
        echo -e "${YELLOW}Cekam da Docker bude spreman (do 60 sekundi)...${NC}"
        for i in {1..60}; do
            if docker info > /dev/null 2>&1; then
                echo -e "${GREEN}✓ Docker je spreman${NC}"
                break
            fi
            echo -n "."
            sleep 1
        done
        echo ""
    fi
fi

# Start database services
echo -e "${BLUE}🐘 Pokrecem PostgreSQL i Redis...${NC}"
docker-compose up -d postgres redis 2>/dev/null || docker compose up -d postgres redis 2>/dev/null

# Wait for postgres to be ready
echo -e "${YELLOW}⏳ Cekam da baza bude spremna...${NC}"
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U crm_user -d crm_db > /dev/null 2>&1 || \
       docker compose exec -T postgres pg_isready -U crm_user -d crm_db > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL je spreman${NC}"
        break
    fi
    sleep 1
done

# Run migrations first
run_migrations

# Check if companies table has data
HAS_DATA=$(docker-compose exec -T postgres psql -U crm_user -d crm_db -tAc "SELECT COUNT(*) FROM companies;" 2>/dev/null || \
           docker compose exec -T postgres psql -U crm_user -d crm_db -tAc "SELECT COUNT(*) FROM companies;" 2>/dev/null || echo "0")

HAS_DATA=$(echo "$HAS_DATA" | tr -d '[:space:]')

if [ "$HAS_DATA" = "0" ] || [ -z "$HAS_DATA" ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Baza je prazna ili nema podataka.${NC}"
    echo -e "${YELLOW}   Preporucujem da seedujes podatke.${NC}"
fi

# Ask user if they want to seed
if ask_for_seed; then
    run_complete_seed
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Start the development environment
start_dev_environment
