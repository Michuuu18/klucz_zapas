import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Wymaga zalogowania (dowolna rola). */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

/** Wymaga roli Admin. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.hasRole('Admin')) {
    return true;
  }

  return router.createUrlTree(auth.isAuthenticated() ? ['/panel'] : ['/login']);
};

/** Wymaga roli Pracownik (Admin też ma dostęp). */
export const employeeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.hasRole('Pracownik')) {
    return true;
  }

  return router.createUrlTree(auth.isAuthenticated() ? ['/admin'] : ['/login']);
};

/** Blokuje dostęp do /login jeśli użytkownik jest już zalogowany. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  const user = auth.currentUser();
  return router.createUrlTree([user?.role === 'Admin' ? '/admin' : '/panel']);
};
