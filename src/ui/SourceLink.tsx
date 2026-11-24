/**
 * Where the code of this deployment lives. The AGPL asks that everyone who
 * uses the app over the network can get its source, so the link is part of
 * the interface. Anyone running a modified version must point this at their
 * own repository.
 */
export const SOURCE_URL = 'https://github.com/JHoerbst/baustellenplaner';

export function SourceLink() {
  return (
    <p className="source-link">
      Der Baustellenplaner ist freie Software unter der AGPL 3.0.{' '}
      <a href={SOURCE_URL} target="_blank" rel="noreferrer">
        Quellcode ansehen
      </a>
    </p>
  );
}
