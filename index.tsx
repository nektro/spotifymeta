import { serve } from "bun";
import { parseArgs } from "node:util";
import { renderToReadableStream } from "react-dom/server";
import { Disc3, Home, Music, User } from "lucide-react";
import { Database } from "bun:sqlite";

const { values } = parseArgs({
  options: {
    port: { type: "string" },
  },
  strict: true,
});

const port = parseInt(values.port!, 10);
if (Number.isNaN(port)) throw new Error("invalid --port: " + values.port);

const PLACES = [
  ["Home", Home, "/"],
  ["Artists", User, "/artists"],
  ["Albums", Disc3, "/albums"],
  ["Tracks", Music, "/tracks"],
] as const;

const db = new Database("./spotify_clean.sqlite3");
const artist_query = db.prepare<Artist, number>("select * from artists where rowid = ? limit 1");
const artistalbum_query = db.prepare<ArtistAlbum, number>("select * from artist_albums where album_rowid = ? and is_implicit_appears_on = 0 limit 1");
const album_query = db.prepare<Album, number>("select * from albums where rowid = ? limit 1");
const track_query = db.prepare<Track, number>("select * from tracks where rowid = ? limit 1");
const market_query = db.prepare<AvailableMarket, number>("select * from available_markets where rowid = ? limit 1");

const _seconds = (ms: number) => (((ms / 1000) | 0) % 60).toString(10).padStart(2, "0");
const _minutes = (ms: number) => (ms / 1000 / 60) | 0;
const _duration = (ms: number) => `${_minutes(ms)}:${_seconds(ms)}`;

const server = serve({
  port,

  routes: {
    "/style3.css": Bun.file("./style3.css"),
    "/script.js": Bun.file("./script.js"),
  },

  async fetch(req) {
    const url = new URL(req.url);
    const pathname = decodeURIComponent(url.pathname);

    const content = Page(req, url, pathname);
    if (!content) {
      return new Response(null, { status: 404 });
    }
    const stream = await renderToReadableStream(content);
    return new Response(stream, { headers: { "Content-Type": "text/html" } });
  },
});

// CREATE TABLE `artists` (
//  `rowid` integer PRIMARY KEY NOT NULL,
//  `id` text NOT NULL,
//  `fetched_at` integer NOT NULL,
//  `name` text NOT NULL,
//  `followers_total` integer NOT NULL,
//  `popularity` integer NOT NULL
// )
type Artist = {
  rowid: number;
  id: string;
  fetched_at: number;
  name: string;
  followers_total: number;
  popularity: number;
};

// CREATE TABLE `artist_images` (
//  `artist_rowid` integer NOT NULL,
//  `width` integer NOT NULL,
//  `height` integer NOT NULL,
//  `url` text NOT NULL,
// )
type ArtistImage = {
  artist_rowid: number;
  width: number;
  height: number;
  url: string;
};

// CREATE TABLE `albums` (
//  `rowid` integer PRIMARY KEY NOT NULL,
//  `id` text NOT NULL,
//  `fetched_at` integer NOT NULL,
//  `name` text NOT NULL,
//  `album_type` text NOT NULL,
//  `available_markets_rowid` integer NOT NULL,
//  `external_id_upc` text,
//  `copyright_c` text,
//  `copyright_p` text,
//  `label` text NOT NULL,
//  `popularity` integer NOT NULL,
//  `release_date` text NOT NULL,
//  `release_date_precision` text NOT NULL,
//  `total_tracks` integer NOT NULL,
//  `external_id_amgid` text,
// )
type Album = {
  rowid: number;
  id: string;
  fetched_at: number;
  name: string;
  album_type: "single" | "album" | "compilation";
  available_markets_rowid: number;
  external_id_upc?: string;
  copyright_c?: string;
  copyright_p?: string;
  label: string;
  popularity: number;
  release_date: string;
  release_date_precision: string;
  total_tracks: number;
  external_id_amgid?: string;
};

// CREATE TABLE "artist_albums" (
//  `artist_rowid` integer NOT NULL,
//  `album_rowid` integer NOT NULL,
//  `is_appears_on` integer NOT NULL,
//  `is_implicit_appears_on` integer NOT NULL,
//  `index_in_album` integer,
// )
type ArtistAlbum = {
  artist_rowid: number;
  album_rowid: number;
  is_appears_on: number;
  is_implicit_appears_on: number;
  index_in_album?: number;
};

// CREATE TABLE "album_images" (
//  `album_rowid` integer NOT NULL,
//  `width` integer NOT NULL,
//  `height` integer NOT NULL,
//  `url` text NOT NULL,
// )
type AlbumImage = {
  album_rowid: number;
  width: number;
  height: number;
  url: string;
};

// CREATE TABLE `available_markets` (
//  `rowid` integer PRIMARY KEY NOT NULL,
//  `available_markets` text NOT NULL
// )
type AvailableMarket = {
  rowid: number;
  available_markets: string;
};

// CREATE TABLE `tracks` (
//  `rowid` integer PRIMARY KEY NOT NULL,
//  `id` text NOT NULL,
//  `fetched_at` integer NOT NULL,
//  `name` text NOT NULL,
//  `preview_url` text,
//  `album_rowid` integer NOT NULL,
//  `track_number` integer NOT NULL,
//  `external_id_isrc` text,
//  `popularity` integer NOT NULL,
//  `available_markets_rowid` integer NOT NULL,
//  `disc_number` integer NOT NULL,
//  `duration_ms` integer NOT NULL,
//  `explicit` integer NOT NULL,
// )
type Track = {
  rowid: number;
  id: string;
  fetched_at: number;
  name: string;
  preview_url?: string;
  album_rowid: number;
  track_number: number;
  external_id_isrc?: string;
  popularity: number;
  available_markets_rowid: number;
  disc_number: number;
  duration_ms: number;
  explicit: 0 | 1;
};

// CREATE TABLE `track_artists` (
//  `track_rowid` integer NOT NULL,
//  `artist_rowid` integer NOT NULL,
// )
type TrackArtist = {
  track_rowid: number;
  artist_rowid: number;
};

function Page(req: Request, url: URL, pathname: string) {
  if (pathname === "/") {
    return (
      <html lang="en">
        <Head />
        <body>
          <Header />
          <div>
            <div className="grid">
              <div className="grid-row grid-gap">
                <Sidenav pathname={pathname} />
              </div>
            </div>
          </div>
        </body>
      </html>
    );
  }

  if (/^\/artists$/.test(pathname)) {
    const artists_query = db.query("select * from artists order by popularity desc limit 50");
    const artists = artists_query.all() as Artist[];
    return (
      <html lang="en">
        <Head />
        <body>
          <Header />
          <div>
            <div className="grid">
              <div className="grid-row grid-gap">
                <Sidenav pathname={pathname} />
                <div className="grid-col-10">
                  <h1>Artists</h1>
                  <ul className="usa-card-group">
                    {artists.map((artist) => (
                      <ArtistCard key={artist.rowid} artist={artist} />
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    );
  }

  if (/^\/artists\/\d+$/.test(pathname)) {
    const id = parseInt(pathname.split("/")[2]!);
    const artist = artist_query.get(id);
    if (artist == null) return null;
    return (
      <html lang="en">
        <Head />
        <body>
          <Header />
          <div>
            <div className="grid">
              <div className="grid-row grid-gap">
                <Sidenav pathname={pathname} />
                <div className="grid-col-10">
                  <h1>{artist.name}</h1>
                  <div className="tabs">
                    <div role="tablist" aria-label="Select your operating system">
                      <button role="tab" aria-selected="true" aria-controls="panel-1" id="tab-1" tabIndex={0}>
                        Albums
                      </button>
                      <button role="tab" aria-selected="false" aria-controls="panel-2" id="tab-2" tabIndex={0}>
                        Singles
                      </button>
                      <button role="tab" aria-selected="false" aria-controls="panel-3" id="tab-3" tabIndex={0}>
                        Compilations
                      </button>
                    </div>
                    <div className="tab-panels">
                      <div id="panel-1" role="tabpanel" tabIndex={0} aria-labelledby="tab-1" hx-get={`/artists/${id}/albums`} hx-trigger="revealed once">
                        <p>Loading Albums...</p>
                      </div>
                      <div id="panel-2" role="tabpanel" tabIndex={0} aria-labelledby="tab-2" hidden hx-get={`/artists/${id}/singles`} hx-trigger="revealed once">
                        <p>Loading Singles...</p>
                      </div>
                      <div id="panel-3" role="tabpanel" tabIndex={0} aria-labelledby="tab-3" hidden hx-get={`/artists/${id}/compilations`} hx-trigger="revealed once">
                        <p>Loading Compilations...</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    );
  }

  if (/^\/artists\/\d+\/(albums|singles|compilations)$/.test(pathname) && req.headers.get("HX-Request")) {
    const id = parseInt(pathname.split("/")[2]!);
    const artist = artist_query.get(id);
    if (artist == null) return null;
    const album_type = pathname.split("/")[3]!.slice(0, -1);

    const artistalbums_query = db.prepare("select * from artist_albums where artist_rowid = ? and is_appears_on = 0 and is_implicit_appears_on = 0");
    const artistalbums_direct = artistalbums_query.all(artist.rowid) as ArtistAlbum[];
    const artistalbums = artistalbums_direct.reduce((pv, cv) => (pv.filter((x) => x.album_rowid === cv.album_rowid).length === 0 ? [...pv, cv] : pv), [] as ArtistAlbum[]);

    const albums_direct = artistalbums.map((v) => album_query.get(v.album_rowid)!);
    const albums = albums_direct
      .filter((v) => v.album_type === album_type)
      .toSorted((a, b) => a.release_date.localeCompare(b.release_date))
      .toReversed();

    return (
      <ul className="usa-card-group">
        {albums.map((row) => (
          <AlbumCard key={row.rowid} album={row} />
        ))}
      </ul>
    );
  }

  if (/^\/albums$/.test(pathname)) {
    const albums_query = db.query("select * from albums order by popularity desc limit 50");
    const albums = albums_query.all() as Album[];
    return (
      <html lang="en">
        <Head />
        <body>
          <Header />
          <div>
            <div className="grid">
              <div className="grid-row grid-gap">
                <Sidenav pathname={pathname} />
                <div className="grid-col-10">
                  <h1>Albums</h1>
                  <ul className="usa-card-group">
                    {albums.map((album) => (
                      <AlbumCard key={album.rowid} album={album} />
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    );
  }

  if (/^\/albums\/\d+$/.test(pathname)) {
    const id = parseInt(pathname.split("/")[2]!);
    const album = album_query.get(id);
    if (album == null) return null;
    const artistalbum = artistalbum_query.get(album.rowid)!;
    const artist = artist_query.get(artistalbum.artist_rowid)!;
    const tracks_query = db.prepare("select * from tracks where album_rowid = ?");
    const tracks = tracks_query.all(album.rowid) as Track[];
    return (
      <html lang="en">
        <Head />
        <body id="page-album">
          <Header />
          <div>
            <div className="grid">
              <div className="grid-row grid-gap">
                <Sidenav pathname={pathname} />
                <div className="grid-col-8">
                  <h1>
                    <a className="usa-link" href={`/artists/${artist.rowid}`}>
                      {artist.name}
                    </a>{" "}
                    &#x203A; {album.name}
                  </h1>

                  <div className="grid">
                    <div className="grid-row grid-gap">
                      <div className="grid-col-3">
                        <AlbumImage albumid={id} w={320} h={320} />
                      </div>
                      <dl className="grid-col-9">
                        <dt>ID:</dt>
                        <dd>{album.rowid}</dd>
                        <dt>Spotify ID:</dt>
                        <dd>
                          <a className="usa-link" href={`https://open.spotify.com/album/${album.id}`} target="_blank">
                            <code>{album.id}</code> ↗
                          </a>
                        </dd>
                        <dt>Album Type:</dt>
                        <dd>{album.album_type.charAt(0).toUpperCase() + album.album_type.slice(1)}</dd>
                        <dt>Available Markets:</dt>
                        <dd>
                          <AvailableMarkets rowid={album.available_markets_rowid} />
                        </dd>
                        <dt>UPC:</dt>
                        <dd>{album.external_id_upc || "N/A"}</dd>
                        <dt>&copy;</dt>
                        <dd>{album.copyright_c}</dd>
                        <dt>&#x2117;</dt>
                        <dd>{album.copyright_p}</dd>
                        <dt>Label:</dt>
                        <dd>{album.label}</dd>
                        <dt>Release Date:</dt>
                        <dd>
                          {album.release_date} ({album.release_date_precision})
                        </dd>
                        <dt>AMGID:</dt>
                        <dd>{album.external_id_amgid || "N/A"}</dd>
                      </dl>
                    </div>
                  </div>

                  <table className="usa-table usa-table--compact as-grid-table">
                    <thead>
                      <tr>
                        <th>Disk</th>
                        <th>Track</th>
                        <th>Name</th>
                        <th>Duration</th>
                        <th>ISRC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tracks.map((row) => (
                        <tr key={row.rowid}>
                          <td>{row.disc_number}</td>
                          <td>{row.track_number}</td>
                          <td>
                            <a href={`/tracks/${row.rowid}`} className="usa-link">
                              {row.name} {row.explicit === 1 && <span className="usa-tag">E</span>}
                            </a>
                          </td>
                          <td>{_duration(row.duration_ms)}</td>
                          <td>{row.external_id_isrc ?? "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    );
  }

  if (/^\/tracks\/\d+$/.test(pathname)) {
    const id = parseInt(pathname.split("/")[2]!);
    const track = track_query.get(id);
    if (track == null) return null;
    const album = album_query.get(track.album_rowid)!;
    const artistalbum = artistalbum_query.get(album.rowid)!;
    const artist = artist_query.get(artistalbum.artist_rowid)!;
    return (
      <html lang="en">
        <Head />
        <body>
          <Header />
          <div>
            <div className="grid">
              <div className="grid-row grid-gap">
                <Sidenav pathname={pathname} />
                <div className="grid-col-8">
                  <h1>
                    <a className="usa-link" href={`/artists/${artist.rowid}`}>
                      {artist.name}
                    </a>{" "}
                    &#x203A;{" "}
                    <a className="usa-link" href={`/albums/${album.rowid}`}>
                      {album.name}
                    </a>{" "}
                    &#x203A; {track.name}
                  </h1>

                  <div className="grid">
                    <div className="grid-row grid-gap">
                      <div className="grid-col-3">
                        <AlbumImage albumid={album.rowid} w={320} h={320} />
                      </div>
                      <dl className="grid-col-9">
                        <dt>ID:</dt>
                        <dd>{id}</dd>
                        <dt>Spotify ID:</dt>
                        <dd>
                          <a className="usa-link" href={`https://open.spotify.com/track/${track.id}`} target="_blank">
                            <code>{track.id}</code> ↗
                          </a>
                        </dd>
                        <dt>ISRC:</dt>
                        <dd>{track.external_id_isrc ?? "N/A"}</dd>
                        <dt>Available Markets:</dt>
                        <dd>
                          <AvailableMarkets rowid={track.available_markets_rowid} />
                        </dd>
                        <dt>Duration:</dt>
                        <dd>{_duration(track.duration_ms)}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return null;
}

function Head() {
  return (
    <head>
      <title>Spotify Metadata Explorer</title>
      <meta charSet="UTF-8" />
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="icon" href="data:," />
      <link rel="stylesheet" href="https://unpkg.com/@uswds/uswds@3.11.0/dist/css/uswds.css" integrity="sha384-G0llpcOOfpdIocwce8kYFUqkiabzRMkzBn3zBHHRag3s/1wb6JKvEnArq0RXjZUT" crossOrigin="anonymous" />
      <link rel="stylesheet" href="/style3.css" />
      <script src="https://unpkg.com/htmx.org@2.0.4/dist/htmx.js" integrity="sha384-oeUn82QNXPuVkGCkcrInrS1twIxKhkZiFfr2TdiuObZ3n3yIeMiqcRzkIcguaof1" crossOrigin="anonymous" />
      <script src="/script.js" defer />
    </head>
  );
}

function Header() {
  return (
    <header className="usa-header usa-header--extended">
      <div className="usa-navbar">
        <div className="usa-logo">
          <em className="usa-logo__text">
            <a href="/" title="Spotify Metadata Explorer">
              Spotify Metadata Explorer
            </a>
          </em>
        </div>
      </div>
    </header>
  );
}

function Sidenav(props: { pathname: string }) {
  return (
    <div className="grid-col-2 sidenav">
      <h3>Discover</h3>
      <nav>
        <ul className="usa-sidenav">
          {PLACES.map(([label, Icon, path]) => (
            <li className="usa-sidenav__item" key={label}>
              <a href={path} className={(path.length > 1 && props.pathname.startsWith(path)) || props.pathname === path ? "usa-current" : undefined}>
                <Icon /> {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function ArtistCard(props: { artist: Artist }) {
  const { artist } = props;
  const image_query = db.prepare("select * from artist_images where artist_rowid = ? and width < 300");
  const image = image_query.get(artist.rowid) as ArtistImage | null;
  return (
    <li className="usa-card">
      <a href={`/artists/${artist.rowid}`}>
        <div className="usa-card__container">
          <div className="usa-card__header">
            <h4 className="usa-card__heading">{artist.name}</h4>
          </div>
          <div className="usa-card__media">
            <div className="usa-card__img">
              <img src={image?.url} width={160} height={160} alt="A placeholder image" />
            </div>
          </div>
        </div>
      </a>
    </li>
  );
}

function AlbumCard(props: { album: Album }) {
  const { album } = props;
  return (
    <li className="usa-card">
      <a href={`/albums/${album.rowid}`}>
        <div className="usa-card__container">
          <div className="usa-card__header">
            <h4 className="usa-card__heading">{album.name}</h4>
          </div>
          <div className="usa-card__media">
            <div className="usa-card__img">
              <AlbumImage albumid={album.rowid} w={160} h={160} />
            </div>
          </div>
          <div className="usa-card__body">
            <div>{album.release_date.slice(0, 4)}</div>
            <div>{album.available_markets_rowid}</div>
          </div>
        </div>
      </a>
    </li>
  );
}

function AlbumImage(props: { albumid: number; w?: number; h?: number }) {
  const image_query = db.prepare("select * from album_images where album_rowid = ? limit 1");
  const image = image_query.get(props.albumid) as AlbumImage | null;
  return <img src={image?.url} width={props.w ?? image?.width ?? 160} height={props.h ?? image?.height ?? 160} alt="A placeholder image" />;
}

function AvailableMarkets(props: { rowid: number }) {
  if (props.rowid === 1) return <>Unavailable</>;
  const markets = market_query.get(props.rowid);
  if (!markets) return <>N/A</>;
  const list = markets.available_markets.split(",").toSorted();
  const regional_indicator = (s: string) => String.fromCodePoint(s.charCodeAt(0) - 65 + 0x1f1e6);
  const flag_emoji = (m: string) => regional_indicator(m[0]!) + regional_indicator(m[1]!);
  return (
    <>
      {list.map((v) => (
        <span key={v} title={v}>
          {flag_emoji(v)}
        </span>
      ))}
    </>
  );
}
