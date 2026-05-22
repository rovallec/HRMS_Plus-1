import { Routes } from '@angular/router';
import { Profile } from './profile/profile';
import { Requests } from './requests/requests';
import { Team } from './team/team';
import { AppeasementAgent } from './appeasement-agent/appeasement-agent';
import { LoginComponent } from './login/login';
import { AuthGuards } from './guards/authGuards';
import { Bimi } from './bimi/bimi';
import { KimcoCases } from './kimco-cases/kimco-cases';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },

  {
    path: '',
    canActivate: [AuthGuards],
    children: [
      { path: 'profile', component: Profile },
      { path: 'team', component: Team },
      { path: 'requests', component: Requests },
      { path: 'appeasement/codes', component: AppeasementAgent },
      { path: 'bimi', component: Bimi },
      { path: 'kimco', component: KimcoCases },      
      { path: '', redirectTo: 'appeasement/codes', pathMatch: 'full' }
    ]
  },

  { path: '**', redirectTo: 'login' }
];
