import type { ActionFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { z } from 'zod';
import type { DeleteCommandsProps } from '~/../bot/utils';
import { deleteCommand, deployCommands, getCommands } from '~/../bot/utils';
import Button from '~/components/ui/FlexSpotButton';
import { envSchema } from '~/utils/helpers';

export const action = async ({ request }: ActionFunctionArgs) => {
  const env = envSchema.parse(process.env);

  const formData = await request.formData();
  const action = formData.get('_action');

  switch (action) {
    case 'registerGuildCommands': {
      await deployCommands({ guildId: env.DEV_GUILD_ID });
      break;
    }
    case 'registerGlobalCommands': {
      await deployCommands(null);
      break;
    }
    case 'deleteCommand': {
      const commandId = z.string().parse(formData.get('commandId'));
      const guildId = z.nullable(z.string()).parse(formData.get('guildId'));
      const params: DeleteCommandsProps = { commandId };

      // We do this for safety, since we're certain this dev guild ID is good.
      if (guildId) params.guildId = env.DEV_GUILD_ID;

      await deleteCommand(params);
      break;
    }
  }

  return typedjson({ message: 'Commands loaded.' });
};

export const loader = async () => {
  const env = envSchema.parse(process.env);

  const guildCommands = await getCommands({ guildId: env.DEV_GUILD_ID });
  const globalCommands = await getCommands(null);

  return typedjson({
    devGuildId: env.DEV_GUILD_ID,
    guildCommands,
    globalCommands,
  });
};

export default function AdminBotPage() {
  const { devGuildId, guildCommands, globalCommands } =
    useTypedLoaderData<typeof loader>();

  return (
    <div>
      <h1>Bot Admin</h1>
      <p>
        You probably don't need to touch these ever, but they're here for new
        commands.
      </p>
      <Form method='post'>
        <div>
          <Button type='submit' name='_action' value='registerGuildCommands'>
            Register Dev Guild Commands
          </Button>
        </div>
        <div>
          <Button type='submit' name='_action' value='registerGlobalCommands'>
            Register Global Commands
          </Button>
        </div>
      </Form>
      <hr />
      <h2>Commands</h2>
      <h3>Global Commands</h3>
      {globalCommands?.map(command => (
        <li key={command.id}>
          {command.name}
          <Form method='post'>
            <input type='hidden' name='commandId' value={command.id} />
            <button type='submit' name='_action' value='deleteCommand'>
              Delete
            </button>
          </Form>
        </li>
      ))}
      <h3>Dev Guild Commands</h3>
      {guildCommands?.map(command => (
        <li key={command.id}>
          {command.name}
          <Form method='post'>
            <input type='hidden' name='commandId' value={command.id} />
            <input type='hidden' name='guildId' value={devGuildId} />
            <button type='submit' name='_action' value='deleteCommand'>
              Delete
            </button>
          </Form>
        </li>
      ))}
    </div>
  );
}
