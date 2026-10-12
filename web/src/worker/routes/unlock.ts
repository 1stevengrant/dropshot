import { setCookie } from 'hono/cookie';
import { createRouter } from '../app';
import { passwordPage } from '../pages/passwordPage';
import { unlockToken, verifyPassword } from '../password';

export const unlock = createRouter();

unlock.post('/:id/unlock', async (c) => {
    const row = await c.get('drops').find(c.req.param('id'));

    if (!row || row.privacy !== 'password' || !row.password_hash) {
        return c.redirect(`/${c.req.param('id')}`);
    }

    const form = await c.req.formData();
    const password = String(form.get('password') ?? '');

    if (!(await verifyPassword(password, row.password_hash))) {
        return c.html(passwordPage(row, true), 401);
    }

    setCookie(c, `unlock_${row.id}`, await unlockToken(row.id, row.password_hash), {
        path: `/${row.id}`,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 30,
    });

    return c.redirect(`/${row.id}`, 303);
});
