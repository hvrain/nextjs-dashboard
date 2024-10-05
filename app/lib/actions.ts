'use server';

import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const FormSchema = z
  .object({
    id: z.string(),
    customerId: z
      .string({ message: 'Please select Customer' })
      .min(1, { message: 'You Must Select Customer' }),
    amount: z.coerce
      .number()
      .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
      invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
  })
  .required();

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export type StateField = Partial<z.infer<typeof FormSchema>>;

export type StateFieldErrors =
  | {
      [K in keyof StateField]: string[] | undefined;
    }
  | undefined;

export type State = {
  errors?: {
    [K in keyof Omit<StateField, 'id' | 'date'>]: string[] | undefined;
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
  const validateFields = CreateInvoice.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!validateFields.success) {
    return {
      errors: validateFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice',
    };
  }

  const { customerId, status, amount } = validateFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    await sql`
			INSERT INTO Invoices (customer_id, amount, status, date)
			VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
		`;
  } catch (err) {
    return { message: 'Database Error: Failed to Create Invoice' };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  const amountInCents = amount * 100;

  try {
    await sql`
			UPDATE invoices
			SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
			WHERE id = ${id}
		`;
  } catch (err) {
    return { message: 'Database Error: Fail to Update Invoice' };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
    return { message: 'Deleted Invoice.' };
  } catch (err) {
    return { message: 'Database Error: Fail to Delete Invoice' };
  }
}
