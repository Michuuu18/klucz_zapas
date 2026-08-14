import { inject } from '@angular/core';
import { ActivatedRoute, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

function redirectToLogin(returnUrl: string) {
  const router = inject(Router);
  return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
}

/** Wymaga zalogowania (dowolna rola). */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);

  if (auth.isAuthenticated()) {
    return true;
  }

  return redirectToLogin(state.url);
};

/** Wymaga roli Admin. */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.hasRole('Admin')) {
    return true;
  }

  if (!auth.isAuthenticated()) {
    return redirectToLogin(state.url);
  }

  return router.createUrlTree(['/panel']);
};

/** Wymaga roli Pracownik (Admin też ma dostęp). */
export const employeeGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.hasRole('Pracownik')) {
    return true;
  }

  if (!auth.isAuthenticated()) {
    return redirectToLogin(state.url);
  }

  return router.createUrlTree(['/admin']);
};

/** Blokuje dostęp do /login jeśli użytkownik jest już zalogowany. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const route = inject(ActivatedRoute);

  if (!auth.isAuthenticated()) {
    return true;
  }

  const returnUrl = route.snapshot.queryParamMap.get('returnUrl') ?? '';
  if (returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
    return router.parseUrl(returnUrl);
  }

  const user = auth.currentUser();
  return router.createUrlTree([user?.role === 'Admin' ? '/admin' : '/panel']);
};
