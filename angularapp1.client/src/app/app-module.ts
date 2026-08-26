import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { AdminComponent } from './admin/admin.component';
import { HomeComponent } from './home/home.component';
import { InventoryComponent } from './inventory/inventory.component';
import { KeyDetailsComponent } from './key-details/key-details.component';
import { LoginComponent } from './login/login.component';
import { ScannerComponent } from './scanner/scanner.component';
import { authInterceptor } from './interceptors/auth.interceptor';

@NgModule({
  declarations: [
    App,
    HomeComponent,
    ScannerComponent,
    InventoryComponent,
    KeyDetailsComponent,
    LoginComponent,
    AdminComponent,
  ],
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    AppRoutingModule,
  ],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
  bootstrap: [App],
})
export class AppModule {}
