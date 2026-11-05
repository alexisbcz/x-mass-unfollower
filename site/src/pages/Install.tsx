import { Callout } from "twenty-ui/components/feedback";
import { CommandBlock } from "twenty-ui/components/data-display";
import { MainButton, LightButton } from "twenty-ui/components/input";
import { IconBrandGithub, IconDownload, IconInfoCircle, IconPuzzle } from "twenty-ui/icon";
import { PageHead, Panel, REPO, ZIP } from "../ui";

export function Install() {
  return (
    <>
      <PageHead icon={IconPuzzle} hue={145} title="Install" />
      <Panel>
        <div className="tw-doc">
          <h2>Load the extension unpacked</h2>
          <p>
            The extension isn't on the Chrome Web Store. You load it from source, which takes about a minute and works in any Chromium-based browser:
            Chrome, Chromium, Brave, Edge, Arc, Helium and others.
          </p>
          <div className="tw-actions">
            <MainButton startIcon={<IconDownload />} render={<a href={ZIP} />} nativeButton={false}>
              Download ZIP
            </MainButton>
            <LightButton startIcon={<IconBrandGithub />} render={<a href={REPO} target="_blank" rel="noreferrer" />} nativeButton={false}>
              View on GitHub
            </LightButton>
          </div>
          <ol className="tw-steps">
            <li>
              <strong>Get the code</strong>
              Download the ZIP above and unzip it, or clone the repository.
            </li>
            <li>
              <strong>Open the extensions page</strong>
              Go to <code>chrome://extensions</code> (or your browser's equivalent) and turn on <strong>Developer mode</strong>.
            </li>
            <li>
              <strong>Load unpacked</strong>
              Click <strong>Load unpacked</strong> and select the <code>extension</code> folder inside the repository (the folder that contains{" "}
              <code>manifest.json</code>).
            </li>
            <li>
              <strong>Pin it and open x.com</strong>
              Pin the icon to your toolbar and click it. It opens x.com if you're elsewhere, then toggles the panel. You must be logged in to X.
            </li>
          </ol>

          <h2>From the command line</h2>
          <CommandBlock commands={["git clone https://github.com/alexisbcz/x-mass-unfollower.git", "# then: chrome://extensions → Load unpacked → x-mass-unfollower/extension"]} />

          <h2>Updating</h2>
          <p>
            Pull or re-download the code, then press the reload button on the extension's card in <code>chrome://extensions</code>. Your scan results, kept
            accounts and settings are stored on x.com's IndexedDB, so they survive updates.
          </p>

          <Callout
            status="info"
            icon={<IconInfoCircle />}
            title="Nothing to build"
            description="The extension is plain JavaScript with no dependencies and no build step. The website you're reading lives in a separate site/ folder and isn't needed to use the extension."
          />
        </div>
      </Panel>
    </>
  );
}
