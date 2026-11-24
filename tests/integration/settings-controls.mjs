// Shared user-facing interactions for the unified settings panel.
export async function openSettings(page) {
  const dialog = page.getByRole('dialog', {
    name: /^(Настройки сайта|Site settings)$/,
  });
  if (!(await dialog.isVisible()))
    await page
      .getByRole('button', { name: /^(Настройки сайта|Site settings)$/ })
      .click();
  await dialog.waitFor();
  return dialog;
}
export async function closeSettings(page) {
  const dialog = page.getByRole('dialog', {
    name: /^(Настройки сайта|Site settings)$/,
  });
  if (await dialog.isVisible()) {
    await dialog
      .getByRole('button', { name: /^(Закрыть настройки|Close settings)$/ })
      .click();
    await dialog.waitFor({ state: 'detached' });
  }
}
export async function chooseTheme(page, name) {
  const dialog = await openSettings(page);
  await dialog.getByRole('radio', { name, exact: true }).check();
  await closeSettings(page);
}
export async function ambientControl(page) {
  const dialog = await openSettings(page),
    control = dialog.getByRole('switch', {
      name: 'Атмосфера фильма',
      exact: true,
    });
  await control.scrollIntoViewIfNeeded();
  return control;
}
