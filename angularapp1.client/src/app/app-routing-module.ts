import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from './admin/admin.component';
import { adminGuard, authGuard, employeeGuard, guestGuard } from './guards/auth.guard';
import { HomeComponent } from './home/home.component';
import { InventoryComponent } from './inventory/inventory.component';
import { KeyDetailsComponent } from './key-details/key-details.component';
import { LoginComponent } from './login/login.component';
import { ScannerComponent } from './scanner/scanner.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'admin', component: AdminComponent, canActivate: [adminGuard] },
  { path: 'inventory', component: InventoryComponent, canActivate: [adminGuard] },
  { path: 'panel', component: HomeComponent, canActivate: [employeeGuard] },
  { path: 'scanner', component: ScannerComponent, canActivate: [authGuard] },
  { path: 'key/:code', component: KeyDetailsComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
