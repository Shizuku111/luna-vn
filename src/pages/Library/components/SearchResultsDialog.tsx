import { Dialog } from "@/components/Dialog";
import {
  formatSubjectCreditLine,
  type BangumiSearchSubject,
} from "@/features/bangumi";
import "./SearchResultsDialog.css";

type SearchResultsDialogProps = {
  open: boolean;
  subjects: BangumiSearchSubject[];
  onClose: () => void;
  onSelect?: (subject: BangumiSearchSubject) => void;
  selecting?: boolean;
};

function resolveCoverUrl(subject: BangumiSearchSubject) {
  return (
    subject.image ||
    subject.images?.medium ||
    subject.images?.small ||
    subject.images?.large ||
    null
  );
}

export function SearchResultsDialog({
  open,
  subjects,
  onClose,
  onSelect,
  selecting = false,
}: SearchResultsDialogProps) {
  return (
    <Dialog
      open={open}
      title="选择游戏"
      className="library-search-results-dialog"
      onClose={selecting ? undefined : onClose}
      footer={null}
      content={
        <ul className="library-search-results-list">
          {subjects.map((subject) => {
            const coverUrl = resolveCoverUrl(subject);
            const nameCn = subject.name_cn.trim();
            const showNameCn = Boolean(nameCn) && nameCn !== subject.name;
            const creditLine = formatSubjectCreditLine(subject.infobox);
            const summary = subject.summary?.trim() ?? "";
            const releaseDate = subject.date?.trim() ?? "";

            return (
              <li key={subject.id} className="library-search-result-item">
                <button
                  type="button"
                  className="library-search-result-item-button"
                  disabled={selecting}
                  onClick={() => onSelect?.(subject)}
                >
                  <div className="library-search-result-cover">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span
                        className="library-search-result-cover-empty"
                        aria-hidden
                      />
                    )}
                  </div>
                  <div className="library-search-result-meta">
                    <div className="library-search-result-title-row">
                      <span className="library-search-result-name">
                        {subject.name}
                      </span>
                      {showNameCn ? (
                        <span className="library-search-result-name-cn">
                          {nameCn}
                        </span>
                      ) : null}
                    </div>
                    {creditLine ? (
                      <p className="library-search-result-credit">
                        {creditLine}
                      </p>
                    ) : null}
                    {summary ? (
                      <p className="library-search-result-summary">
                        {summary}
                      </p>
                    ) : null}
                    {releaseDate ? (
                      <p className="library-search-result-release">
                        发行：{releaseDate}
                      </p>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      }
    />
  );
}
