import Layout from "@/src/components/dashboard/layout/Layout";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { LinkGeneratorHeader } from "@/src/features/link-generator/components/LinkGeneratorHeader";
import { LinkAnalysis } from "@/src/features/link-generator/components/LinkAnalysis";
import { LinkGenerator } from "@/src/features/link-generator/components/LinkGenerator";
import { useLinkAnalyzer } from "@/src/features/link-generator/hooks/useLinkAnalyzer";
import { useLinkGenerator } from "@/src/features/link-generator/hooks/useLinkGenerator";

export default function LinkGeneratorPage() {
  const {
    url,
    setUrl,
    parsedUrl,
    handleAnalyze,
    isLoading: isAnalyzing,
  } = useLinkAnalyzer({
    onAnalysisStart: () => {
      linkGenerator.reset();
    },
  });

  const linkGenerator = useLinkGenerator(parsedUrl);
  const {
    vid,
    setVid,
    customVid,
    setCustomVid,
    isCustomVid,
    setIsCustomVid,
    generatedLink,
    isLoading: isGenerating,
    generatePartnerLink,
  } = linkGenerator;

  return (
    <Layout>
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center space-y-8">
          <LinkGeneratorHeader />

          {/* Input Section */}
          <div className="bg-card w-full max-w-4xl space-y-4 rounded-lg border p-6 shadow-sm">
            <div className="relative">
              <Input
                type="url"
                placeholder="Введите ссылку для анализа..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-12 pr-24 text-lg"
                disabled={isAnalyzing}
              />
              {url && (
                <button
                  type="button"
                  onClick={() => setUrl("")}
                  className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex justify-center">
              <Button
                onClick={handleAnalyze}
                disabled={!url || isAnalyzing}
                className="bg-primary text-primary-foreground relative h-11 min-w-[200px] shadow-sm"
                size="lg"
              >
                {isAnalyzing ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Анализ...</span>
                  </div>
                ) : (
                  "Анализировать"
                )}
              </Button>
            </div>
          </div>

          {/* Results Section */}
          {parsedUrl && (
            <div className="grid w-full gap-6 lg:grid-cols-2">
              <LinkAnalysis url={url} parsedUrl={parsedUrl} />
              <LinkGenerator
                parsedUrl={parsedUrl}
                vid={vid}
                setVid={setVid}
                customVid={customVid}
                setCustomVid={setCustomVid}
                isCustomVid={isCustomVid}
                setIsCustomVid={setIsCustomVid}
                generatedLink={generatedLink}
                isLoading={isGenerating}
                onGenerateLink={generatePartnerLink}
              />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
