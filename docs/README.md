# 📚 CRM System - Documentation

Dobrodošli u dokumentaciju CRM sistema! Ovde ćete pronaći sve potrebne informacije za razvoj, deployment i korišćenje sistema.

## 📋 Sadržaj Dokumentacije

### 🚀 Za Početnike

1. **[SETUP.md](./SETUP.md)** - Development Environment Setup

   - Instalacija dependencies (Bun, PostgreSQL, Redis)
   - Environment konfiguracija
   - Database setup i seeding
   - VS Code podešavanja
   - Troubleshooting česti problemi

2. **[API.md](./API.md)** - API Dokumentacija
   - Kompletna lista svih endpoints
   - Request/Response primeri
   - Autentifikacija i autorizacija
   - Rate limiting
   - Error handling
   - API keys i integration guide

### 🤖 AI System (NEW!)

**[🎯 AI INDEX](./AI_INDEX.md)** - **START HERE** za AI dokumentaciju

#### Quick Reference

- **[AI Module Guide](./AI_MODULE.md)** - Complete module documentation (NEW!)
- **[AI Quick Reference](./AI_QUICK_REFERENCE.md)** - Cheat sheet for common operations (NEW!)

#### Detailed Guides

- **[AI README](./AI_README.md)** - Quick start i overview (11 KB)
- **[AI Examples](./AI_EXAMPLES.md)** - 40+ code examples (29 KB)
- **[Agents Guide](./AI_AGENTS_GUIDE.md)** - Agent development (10 KB)
- **[Tools Guide](./AI_TOOLS_GUIDE.md)** - Tool development (15 KB)
- **[API Reference](./AI_API_REFERENCE.md)** - AI REST API (11 KB)
- **[Document Processing](./AI_DOCUMENT_PROCESSING.md)** - PDF/Image AI (18 KB)
- **[Embeddings](./AI_EMBEDDINGS_GUIDE.md)** - Semantic search (10 KB)
- **[Deployment](./AI_DEPLOYMENT.md)** - Production guide (16 KB)
- **[Troubleshooting](./AI_TROUBLESHOOTING.md)** - Problem solving (11 KB)
- **[Architecture](./AI_ARCHITECTURE_DIAGRAM.md)** - Visual diagrams (19 KB)

> **14 dokumenata | 8,000+ linija | 180+ KB dokumentacije**

### 🏗️ Za Developere

3. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System Architecture

   - High-level arhitektura
   - Monorepo struktura
   - Tech stack detalji
   - Database schema
   - Security architecture
   - Performance optimizations
   - Design patterns

4. **[TESTING.md](./TESTING.md)** - Testing Guide
   - Test infrastructure (Vitest)
   - Kako pokrenuti testove
   - Writing tests (unit, integration, E2E)
   - Test coverage status
   - Best practices
   - CI/CD integration

### 📊 Za Project Managere

5. **[ROADMAP.md](./ROADMAP.md)** - Product Roadmap _(coming soon)_

   - Feature timeline (60/90/180 dana)
   - Priority matrix
   - Technical debt tracking
   - Release planning

6. **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment Guide _(coming soon)_
   - Production deployment
   - Infrastructure setup
   - Environment variables
   - Monitoring & alerts
   - Backup & recovery

## 🎯 Quick Links

### Development

```bash
# Start development
bun run dev

# Run tests
bun test

# Build for production
bun run build
```

### API Endpoints

- **Health**: `GET /health`
- **API Info**: `GET /api/v1`
- **Login**: `POST /api/v1/auth/login`
- **Users**: `GET /api/v1/users`
- **Companies**: `GET /api/v1/companies`

Kompletna lista: [API.md](./API.md)

### Test Credentials

Development environment:

- **Admin**: `admin@crm.com` / `Admin123!`
- **User**: `user@crm.com` / `User123!`

## 📖 Dodatni Resursi

### External Documentation

- [Bun Documentation](https://bun.sh/docs)
- [Next.js 16 App Router](https://nextjs.org/docs)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Tailwind CSS 4.0](https://tailwindcss.com/docs)
- [React 19](https://react.dev/)
- [Vitest](https://vitest.dev/)

### Design Resources

- [Figma Designs](#) _(link to designs)_
- [Component Library](#) _(link to Storybook)_
- [Brand Guidelines](#) _(link to brand assets)_

## 🗺️ Documentation Navigation

```
docs/
├── README.md           # ← You are here!
├── SETUP.md            # Development environment setup
├── API.md              # Complete API reference
├── ARCHITECTURE.md     # System architecture & design
├── TESTING.md          # Testing guide & coverage
├── DEPLOYMENT.md       # Production deployment (coming soon)
├── ROADMAP.md          # Product roadmap (coming soon)
├── CONTRIBUTING.md     # Contribution guidelines (coming soon)
└── CHANGELOG.md        # Version history (coming soon)
```

## 🎓 Learning Path

### Novi Developer (Prvi Dan)

1. ✅ Pročitaj [SETUP.md](./SETUP.md)
2. ✅ Setup local environment
3. ✅ Pokreni aplikaciju
4. ✅ Login sa test credentials
5. ✅ Explore API sa `/api/v1` endpoint

### Razumevanje Sistema (Prvi Nedelja)

1. ✅ Pročitaj [ARCHITECTURE.md](./ARCHITECTURE.md)
2. ✅ Pregledaj database schema
3. ✅ Pročitaj [API.md](./API.md)
4. ✅ Testiraj key endpoints sa Postman
5. ✅ Pročitaj [TESTING.md](./TESTING.md)
6. ✅ Napiši prvi test

### Contributing (Prvi Mesec)

1. ✅ Review existing code
2. ✅ Pick a task from backlog
3. ✅ Napiši testove
4. ✅ Implement feature
5. ✅ Submit PR
6. ✅ Code review process

## 📊 Project Status

### Current Stats (2025-12-01)

- **Version**: 1.0.0
- **Backend Tests**: 237 pass / 240 total (98.8%)
- **API Endpoints**: 80+ endpoints
- **Database Tables**: 20+ entities
- **Lines of Code**: ~15,000 LOC
- **Dependencies**: Up to date ✅

### Recent Updates

- ✅ Complete test suite implementation (240 tests)
- ✅ JWT & session management
- ✅ Rate limiting middleware
- ✅ API key authentication
- ✅ Background jobs (BullMQ)
- ✅ Comprehensive API documentation

### Upcoming

- ⏳ WebSocket support for real-time updates
- ⏳ Advanced analytics dashboard
- ⏳ Email templates builder
- ⏳ Mobile app (React Native)
- ⏳ GraphQL API

## 🔐 Security

### Reporting Security Issues

Ako pronađete security vulnerability:

1. **NE** kreirajte public GitHub issue
2. Pošaljite email na: security@crm.example.com
3. Uključite:
   - Detaljat opis vulnerability-ja
   - Korake za reprodukciju
   - Potencijalni impact
   - Predloženo rešenje (ako imate)

Odgovorićemo u roku od 24 sata.

### Security Features

- ✅ JWT authentication (HS256)
- ✅ bcrypt password hashing (cost 12)
- ✅ HttpOnly cookies
- ✅ CSRF protection
- ✅ Rate limiting
- ✅ Input validation (Zod)
- ✅ SQL injection protection
- ✅ XSS protection
- ✅ CORS configuration
- ✅ Audit logging

## 🤝 Contributing

Zainteresovani za contributing? Super!

1. Read [CONTRIBUTING.md](./CONTRIBUTING.md) _(coming soon)_
2. Fork repository
3. Create feature branch
4. Write tests
5. Implement feature
6. Submit pull request

### Code Standards

- **TypeScript**: Strict mode enabled
- **Formatting**: Biome (auto-format on save)
- **Testing**: Vitest (98%+ coverage required)
- **Commits**: Conventional commits format
- **Branching**: GitFlow model

## 📞 Support

### Community

- **Discord**: [Join our server](#) _(coming soon)_
- **Forum**: [Community forum](#) _(coming soon)_
- **Twitter**: [@CRMSystem](#) _(coming soon)_

### Professional Support

- **Email**: support@crm.example.com
- **Docs**: https://docs.crm.example.com
- **Status**: https://status.crm.example.com

### Office Hours

Developer office hours: **Thursdays 2-4 PM CET**

- Video call: [Zoom link](#)
- Q&A, pair programming, code review

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🙏 Acknowledgments

### Technologies

Zahvaljujemo svim open-source projektima koji su omogućili ovaj sistem:

- **Bun** - Fast JavaScript runtime
- **Next.js** - React framework
- **Drizzle ORM** - TypeScript ORM
- **Tailwind CSS** - Utility-first CSS
- **shadcn/ui** - Beautiful components
- **Radix UI** - Accessible primitives
- **Vitest** - Fast unit testing
- **BullMQ** - Background jobs
- **Redis** - Caching & sessions
- **PostgreSQL** - Reliable database

### Contributors

Hvala svim kontributorima! 🎉

_(Lista će biti dodana)_

---

## 📊 Documentation Stats

- **Total Pages**: 17 (5 core + 12 AI docs)
- **Total Lines**: 10,000+
- **Total Size**: 200+ KB
- **Last Updated**: 2024-12-02
- **Version**: 1.0.0
- **Maintainers**: Development Team

---

**Happy Coding!** 🚀

Za pitanja ili sugestije, kontaktirajte: dev@crm.example.com
