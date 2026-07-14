import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const Role6Guard: CanActivateFn = () => {
  const router = inject(Router);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = Number(user.idRole ?? user.role ?? 0);
  return role === 6 ? true : router.createUrlTree(['/']);
};
