import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { KeyDetailsComponent } from './key-details/key-details.component';
import { ScannerComponent } from './scanner/scanner.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'scanner', component: ScannerComponent },
  { path: 'key/:code', component: KeyDetailsComponent },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
