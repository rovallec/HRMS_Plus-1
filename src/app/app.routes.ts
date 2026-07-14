import { Routes } from '@angular/router';
import { Profile } from './profile/profile';
import { Requests } from './requests/requests';
import { Team } from './team/team';
import { AppeasementAgent } from './appeasement-agent/appeasement-agent';
import { LoginComponent } from './login/login';
import { AuthGuards } from './guards/authGuards';
import { Bimi } from './bimi/bimi';
import { KimcoCases } from './kimco-cases/kimco-cases';
import { CxCustomerOMS } from './cx-customer-oms/cx-customer-oms';
import { CxOms } from './cx-oms/cx-oms';
import { KimcoPropertyManagement } from './kimco-property-management/kimco-property-management';
import { OpenWA } from './open-wa/open-wa';
import { KimcoDbChangesComponent } from './kimco-dbchanges/kimco-dbchanges';
import { TaAdmin } from './ta/ta-admin';
import { TaFormRenderer } from './ta/ta-form';
import { Role6Guard } from './guards/role6Guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'customer/:token', component: CxCustomerOMS },
  { path: 'ta/form/:slug', component: TaFormRenderer },
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
      { path: 'OMS', component: CxCustomerOMS },
      { path: 'cxOMS', component: CxOms },
      { path: 'kimPm', component:KimcoPropertyManagement},
      {path: 'openWA', component:OpenWA},
      { path: 'kimcoSync', component: KimcoDbChangesComponent },
      { path: 'ta', component: TaAdmin, canActivate: [Role6Guard] },
      { path: '', redirectTo: 'appeasement/codes', pathMatch: 'full' }
    ]
  },

  { path: '**', redirectTo: 'login' }
];
