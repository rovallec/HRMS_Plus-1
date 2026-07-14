import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AppeasementService } from '../services/appeasement.service';

@Component({
  selector: 'app-side-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './side-bar.html',
  styleUrls: ['./side-bar.css']
})
export class SideBar {

  sidebarOpen = false;

  constructor(private api: AppeasementService) {}

  // =========================================================
  // CURRENT USER
  // =========================================================

  currentUser: any =
    JSON.parse(
      localStorage.getItem('user') || '{}'
    );

  // =========================================================
  // HELPERS
  // =========================================================

  get role(): number {
    return Number(this.currentUser?.idRole ?? this.currentUser?.role ?? 0);
  }

  get username(): string {
    return this.currentUser?.username || '';
  }

  get isAdmin(): boolean {
    return this.role === 1;
  }

  logout(): void {

    if (confirm('Are you sure you want to log out?')) {

      this.api.logout();

    }

  }

  
toggleSidebar() {
  this.sidebarOpen = !this.sidebarOpen;
}

}
