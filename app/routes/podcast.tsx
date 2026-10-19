//podcasts.apple.com/ph/podcast/trash-turtle-football/id1586577488
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import LocalDateTime from '~/components/ui/LocalDateTime';
import { PageHeader } from '~/components/ui/page-header';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { getEpisodes } from '~/models/episode.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Trash Turtle Football' };

export const loader = async () => {
  const episodes = await getEpisodes();

  return typedjson({ episodes });
};

export default function Podcast() {
  const { episodes } = useTypedLoaderData<typeof loader>();
  return (
    <>
      <PageHeader
        title='Trash Turtle Football'
        description='DrTrashdad and Bootzfantasy. The archive: no new episodes are being made.'
        actions={
          <img
            alt='Trash Turtle Football logo'
            src='/ttflogowords.jpg'
            className='size-36'
          />
        }
      />

      <p className='max-w-prose'>
        Unleashed from the iconic Flexspot Fantasy Football Discord server, Dr.
        Trashdad and Bootz bring the next generation of a fantasy football
        podcast. A conversation between a numbers and spreadsheets analyst and a
        film room or gut drafter, Bootz and Trashdad talk about fantasy relevant
        topics to help you get the edge you need in your league. Redraft,
        dynasty, bestball, and even some sportsbetting are common topics. Listen
        to us to get in-depth and less talked-about fantasy knowledge without
        the fluff.
      </p>

      <Section title='Episodes'>
        <Table headers={['Episode', 'Published']}>
          {episodes.map(episode => (
            <tr key={episode.id}>
              <td>{episode.title}</td>
              <td className='whitespace-nowrap text-muted-foreground'>
                <LocalDateTime
                  value={episode.publishDate}
                  options={{ year: 'numeric', month: 'long', day: 'numeric' }}
                />
              </td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}
