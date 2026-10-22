import { Component, input, output } from '@angular/core';

@Component({
  selector: 'cms-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  readonly identity = input('');
  readonly initializing = input(false);
  readonly error = input('');
  readonly signIn = output<void>();
  readonly signOut = output<void>();
}
