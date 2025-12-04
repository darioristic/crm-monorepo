import { describe, it, expect } from 'vitest';
import {
  uuidSchema,
  emailSchema,
  passwordSchema,
  simplePasswordSchema,
  dateSchema,
  phoneSchema,
  paginationSchema,
  loginSchema,
  registerSchema,
  changePasswordSchema,
  currencySchema,
  positiveNumberSchema,
  nonNegativeNumberSchema,
} from '../../validators/schemas';

describe('Common Validators', () => {
  describe('uuidSchema', () => {
    it('should validate correct UUIDs', () => {
      const validUUIDs = [
        '550e8400-e29b-41d4-a716-446655440000',
        '123e4567-e89b-12d3-a456-426614174000',
      ];

      for (const uuid of validUUIDs) {
        const result = uuidSchema.safeParse(uuid);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid UUIDs', () => {
      const invalidUUIDs = ['not-a-uuid', '123', '', 'abc-def-ghi'];

      for (const uuid of invalidUUIDs) {
        const result = uuidSchema.safeParse(uuid);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('emailSchema', () => {
    it('should validate and normalize correct emails', () => {
      const result = emailSchema.safeParse('TEST@EXAMPLE.COM');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test@example.com');
      }
    });

    it('should reject invalid emails', () => {
      const invalidEmails = ['notanemail', '@example.com', 'user@', ''];

      for (const email of invalidEmails) {
        const result = emailSchema.safeParse(email);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('passwordSchema', () => {
    it('should validate strong passwords', () => {
      const validPasswords = [
        'Test123!@#',
        'MyP@ssw0rd',
        'Str0ng!Pass',
        'Abcd1234!',
      ];

      for (const password of validPasswords) {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(true);
      }
    });

    it('should reject weak passwords - too short', () => {
      const result = passwordSchema.safeParse('Test1!');
      expect(result.success).toBe(false);
    });

    it('should reject passwords without uppercase', () => {
      const result = passwordSchema.safeParse('test1234!');
      expect(result.success).toBe(false);
    });

    it('should reject passwords without lowercase', () => {
      const result = passwordSchema.safeParse('TEST1234!');
      expect(result.success).toBe(false);
    });

    it('should reject passwords without numbers', () => {
      const result = passwordSchema.safeParse('TestTest!');
      expect(result.success).toBe(false);
    });

    it('should reject passwords without special characters', () => {
      const result = passwordSchema.safeParse('Test1234');
      expect(result.success).toBe(false);
    });

    it('should reject too long passwords', () => {
      const longPassword = `A1!${'a'.repeat(130)}`;
      const result = passwordSchema.safeParse(longPassword);
      expect(result.success).toBe(false);
    });
  });

  describe('simplePasswordSchema', () => {
    it('should accept simple passwords with minimum 8 characters', () => {
      const passwords = ['12345678', 'simple12', 'testpass'];

      for (const password of passwords) {
        const result = simplePasswordSchema.safeParse(password);
        expect(result.success).toBe(true);
      }
    });

    it('should reject passwords shorter than 8 characters', () => {
      const result = simplePasswordSchema.safeParse('test123');
      expect(result.success).toBe(false);
    });
  });

  describe('dateSchema', () => {
    it('should validate ISO datetime strings', () => {
      const validDates = [
        '2024-01-15T10:30:00Z',
        '2024-01-15T10:30:00.000Z',
        '2024-12-31T23:59:59.999Z',
      ];

      for (const date of validDates) {
        const result = dateSchema.safeParse(date);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid date formats', () => {
      const invalidDates = ['2024-01-15', '15/01/2024', 'not-a-date', ''];

      for (const date of invalidDates) {
        const result = dateSchema.safeParse(date);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('phoneSchema', () => {
    it('should validate phone numbers', () => {
      const validPhones = [
        '+1234567890',
        '+1 (234) 567-890',
        '123-456-7890',
      ];

      for (const phone of validPhones) {
        const result = phoneSchema.safeParse(phone);
        expect(result.success).toBe(true);
      }
    });

    it('should accept null and undefined', () => {
      expect(phoneSchema.safeParse(null).success).toBe(true);
      expect(phoneSchema.safeParse(undefined).success).toBe(true);
    });

    it('should reject too short phone numbers', () => {
      const result = phoneSchema.safeParse('123');
      expect(result.success).toBe(false);
    });
  });

  describe('currencySchema', () => {
    it('should validate and normalize currency codes', () => {
      const result = currencySchema.safeParse('usd');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('USD');
      }
    });

    it('should accept valid 3-letter codes', () => {
      const currencies = ['USD', 'EUR', 'GBP', 'JPY'];

      for (const currency of currencies) {
        const result = currencySchema.safeParse(currency);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid currency codes', () => {
      const invalidCurrencies = ['US', 'EURO', 'A', ''];

      for (const currency of invalidCurrencies) {
        const result = currencySchema.safeParse(currency);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('positiveNumberSchema', () => {
    it('should validate positive numbers', () => {
      const numbers = [1, 0.1, 100, 999.99];

      for (const num of numbers) {
        const result = positiveNumberSchema.safeParse(num);
        expect(result.success).toBe(true);
      }
    });

    it('should reject zero and negative numbers', () => {
      expect(positiveNumberSchema.safeParse(0).success).toBe(false);
      expect(positiveNumberSchema.safeParse(-1).success).toBe(false);
      expect(positiveNumberSchema.safeParse(-0.1).success).toBe(false);
    });
  });

  describe('nonNegativeNumberSchema', () => {
    it('should validate zero and positive numbers', () => {
      const numbers = [0, 1, 0.1, 100];

      for (const num of numbers) {
        const result = nonNegativeNumberSchema.safeParse(num);
        expect(result.success).toBe(true);
      }
    });

    it('should reject negative numbers', () => {
      expect(nonNegativeNumberSchema.safeParse(-1).success).toBe(false);
      expect(nonNegativeNumberSchema.safeParse(-0.1).success).toBe(false);
    });
  });
});

describe('Pagination & Filtering', () => {
  describe('paginationSchema', () => {
    it('should use default values', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20);
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('should coerce string numbers', () => {
      const result = paginationSchema.safeParse({ page: '5', pageSize: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
        expect(result.data.pageSize).toBe(50);
      }
    });

    it('should reject negative page numbers', () => {
      const result = paginationSchema.safeParse({ page: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject page size > 100', () => {
      const result = paginationSchema.safeParse({ pageSize: 101 });
      expect(result.success).toBe(false);
    });

    it('should validate sortOrder enum', () => {
      expect(paginationSchema.safeParse({ sortOrder: 'asc' }).success).toBe(true);
      expect(paginationSchema.safeParse({ sortOrder: 'desc' }).success).toBe(true);
      expect(paginationSchema.safeParse({ sortOrder: 'invalid' }).success).toBe(false);
    });
  });
});

describe('Auth Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const loginData = {
        email: 'test@example.com',
        password: 'anyPassword',
      };
      const result = loginSchema.safeParse(loginData);
      expect(result.success).toBe(true);
    });

    it('should normalize email', () => {
      const loginData = {
        email: 'TEST@EXAMPLE.COM',
        password: 'pass',
      };
      const result = loginSchema.safeParse(loginData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('should reject missing fields', () => {
      expect(loginSchema.safeParse({ email: 'test@example.com' }).success).toBe(false);
      expect(loginSchema.safeParse({ password: 'pass' }).success).toBe(false);
      expect(loginSchema.safeParse({}).success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'pass',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('should validate correct registration data', () => {
      const registerData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Test123!@#',
      };
      const result = registerSchema.safeParse(registerData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('user'); // Default role
      }
    });

    it('should trim names', () => {
      const registerData = {
        firstName: '  John  ',
        lastName: '  Doe  ',
        email: 'john@example.com',
        password: 'Test123!@#',
      };
      const result = registerSchema.safeParse(registerData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.firstName).toBe('John');
        expect(result.data.lastName).toBe('Doe');
      }
    });

    it('should accept admin role', () => {
      const registerData = {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        password: 'Test123!@#',
        role: 'admin' as const,
      };
      const result = registerSchema.safeParse(registerData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('admin');
      }
    });

    it('should reject weak passwords', () => {
      const registerData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'weak',
      };
      const result = registerSchema.safeParse(registerData);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      expect(registerSchema.safeParse({ firstName: 'John' }).success).toBe(false);
      expect(registerSchema.safeParse({ lastName: 'Doe' }).success).toBe(false);
      expect(registerSchema.safeParse({ email: 'test@example.com' }).success).toBe(false);
    });

    it('should reject names longer than 100 characters', () => {
      const registerData = {
        firstName: 'A'.repeat(101),
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Test123!@#',
      };
      const result = registerSchema.safeParse(registerData);
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('should validate password change data', () => {
      const changeData = {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
      };
      const result = changePasswordSchema.safeParse(changeData);
      expect(result.success).toBe(true);
    });

    it('should enforce strong password for new password', () => {
      const changeData = {
        currentPassword: 'anything',
        newPassword: 'weak',
      };
      const result = changePasswordSchema.safeParse(changeData);
      expect(result.success).toBe(false);
    });

    it('should allow any current password (validation happens server-side)', () => {
      const changeData = {
        currentPassword: 'a',
        newPassword: 'NewPass123!',
      };
      const result = changePasswordSchema.safeParse(changeData);
      expect(result.success).toBe(true);
    });

    it('should reject missing fields', () => {
      expect(changePasswordSchema.safeParse({ currentPassword: 'old' }).success).toBe(false);
      expect(changePasswordSchema.safeParse({ newPassword: 'New123!' }).success).toBe(false);
    });
  });
});
