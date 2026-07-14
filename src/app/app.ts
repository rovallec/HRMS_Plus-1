import { Component, signal } from '@angular/core';
import { RouterOutlet, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SideBar } from './side-bar/side-bar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterModule, CommonModule, SideBar],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('My Cxperts');

  constructor(private router: Router) {}

  /** Hide sidebar when on login route */
  isLoginPage(): boolean {
    return this.router.url.includes('/login');
  }
isCustomerOMS(): boolean {
  return this.router.url.includes('/customer/') || this.router.url.includes('/ta/form/');
}
}
