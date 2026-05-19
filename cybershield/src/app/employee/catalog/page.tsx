import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, Clock, CheckCircle2, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Category definitions ─────────────────────────────────────────────────────

const CATEGORIES = [
  {
    key: "all",
    label: "All Courses",
    description: "Every course in the library.",
  },
  {
    key: "general",
    label: "General",
    description: "Core security skills for every employee: phishing, passwords, MFA, safe browsing, data handling, and more.",
    frameworks: ["GENERAL"],
    tracks: ["PHISHING_DEFENSE", "SECURITY_AWARENESS", "DATA_PRIVACY", "INCIDENT_RESPONSE"],
  },
  {
    key: "healthcare",
    label: "Healthcare",
    description: "Security guidance specific to healthcare environments, clinical staff, and patient data handling.",
    frameworks: ["HIPAA"],
  },
  {
    key: "finance",
    label: "Finance",
    description: "Security scenarios relevant to financial services, including fraud prevention and wire transfer verification.",
    frameworks: ["GLBA", "PCI_DSS", "SOX"],
  },
  {
    key: "education",
    label: "Education",
    description: "Security training for schools, colleges, and universities covering student data, FERPA, and safe digital practices.",
    frameworks: ["FERPA"],
  },
  {
    key: "government",
    label: "Government",
    description: "Security awareness for public sector employees covering classified data, insider threats, and national cyber guidance.",
    frameworks: ["NIST_CSF", "CIS_CONTROLS"],
  },
  {
    key: "technology",
    label: "Technology",
    description: "Security training for technology teams: secure development, cloud risk, supply chain awareness, and DevSecOps basics.",
    frameworks: ["SOC2", "ISO_27001"],
  },
  {
    key: "retail",
    label: "Retail",
    description: "Security training for retail and e-commerce environments covering card data protection and point-of-sale threats.",
    frameworks: ["PCI_DSS"],
  },
  {
    key: "compliance-standards",
    label: "Compliance Standards",
    description: "Courses mapped to NIST CSF, ISO 27001, CIS Controls, SOC 2, and PCI DSS.",
    frameworks: ["NIST_CSF", "ISO_27001", "CIS_CONTROLS", "SOC2", "PCI_DSS"],
  },
  {
    key: "compliance-regulations",
    label: "Regulations",
    description: "Courses covering GDPR, HIPAA, CCPA, GLBA, FERPA, and SOX obligations.",
    frameworks: ["GDPR", "HIPAA", "CCPA", "GLBA", "FERPA", "SOX"],
  },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];

// ─── Tag display mapping ──────────────────────────────────────────────────────

const FRAMEWORK_LABELS: Record<string, string> = {
  GENERAL:      "General",
  NIST_CSF:     "NIST CSF",
  ISO_27001:    "ISO 27001",
  CIS_CONTROLS: "CIS Controls",
  SOC2:         "SOC 2",
  PCI_DSS:      "PCI DSS",
  HIPAA:        "HIPAA",
  GDPR:         "GDPR",
  CCPA:         "CCPA",
  GLBA:         "GLBA",
  FERPA:        "FERPA",
  SOX:          "SOX",
};

function frameworkBadge(fw: string) {
  const regulated = ["HIPAA", "GDPR", "CCPA", "GLBA", "FERPA", "SOX"];
  if (regulated.includes(fw)) return "outline";
  return "secondary";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as any).role as string;
  // Employees only see assigned courses — the full library is for admins and managers only
  if (role === "EMPLOYEE") redirect("/employee/courses");
  const userId = session.user.id!;

  const activeCategory = (searchParams.category ?? "all") as CategoryKey;
  const searchQuery    = (searchParams.q ?? "").toLowerCase().trim();

  const [courses, enrollments] = await Promise.all([
    db.course.findMany({
      where: { status: "PUBLISHED" },
      include: { _count: { select: { modules: true } } },
      orderBy: [{ isMandatory: "desc" }, { title: "asc" }],
    }),
    db.enrollment.findMany({
      where: { userId },
      select: { courseId: true, status: true, progressPct: true },
    }),
  ]);

  const enrollmentMap = new Map(enrollments.map((e) => [e.courseId, e]));

  // Filter by active category
  const activeCat = CATEGORIES.find((c) => c.key === activeCategory);

  const filteredCourses = courses.filter((course) => {
    // Search filter
    if (searchQuery) {
      const haystack = (course.title + " " + course.description).toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }

    if (activeCategory === "all") return true;

    if (activeCat && "frameworks" in activeCat) {
      // Match if course has ANY of the category's frameworks
      const courseFrameworks = (course.complianceFrameworks ?? []) as string[];
      return (activeCat.frameworks as readonly string[]).some((f) => courseFrameworks.includes(f));
    }

    if (activeCat && "tracks" in activeCat) {
      // General category: match by GENERAL framework OR any of the listed tracks
      const courseFrameworks = (course.complianceFrameworks ?? []) as string[];
      const hasGeneral = courseFrameworks.includes("GENERAL");
      const hasTrack   = (activeCat.tracks as readonly string[]).includes(course.track ?? "");
      return hasGeneral || hasTrack;
    }

    return true;
  });

  return (
    <div className="p-6 max-w-5xl">
      {/* Page header */}
      <div className="mb-6">
        <nav className="flex items-center gap-1.5 text-xs text-text-muted mb-2">
          <Link href="/employee" className="hover:text-text-secondary">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-accent">Course Library</span>
        </nav>
        <h1 className="text-2xl font-heading font-bold text-text-primary">Course Library</h1>
        <p className="text-text-secondary text-sm mt-1">
          {courses.length} courses available — browse by topic or search by name.
        </p>
      </div>

      {/* Search + category tabs */}
      <div className="mb-6 space-y-4">
        {/* Search bar */}
        <form method="GET" className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Search courses…"
            className="w-full max-w-sm pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50"
          />
          {searchParams.category && (
            <input type="hidden" name="category" value={searchParams.category} />
          )}
        </form>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.key}
              href={`/employee/catalog?category=${cat.key}${searchQuery ? `&q=${searchQuery}` : ""}`}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                activeCategory === cat.key
                  ? "bg-accent text-white border-accent"
                  : "bg-surface text-text-secondary border-border hover:border-accent/40 hover:text-text-primary"
              )}
            >
              {cat.label}
            </Link>
          ))}
        </div>

        {/* Category description */}
        {activeCat && activeCat.key !== "all" && (
          <p className="text-sm text-text-muted">{activeCat.description}</p>
        )}
      </div>

      {/* Results */}
      {filteredCourses.length === 0 ? (
        <div className="card p-10 text-center text-text-muted">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No courses match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCourses.map((course) => {
            const enrollment = enrollmentMap.get(course.id);
            const isEnrolled = !!enrollment;
            const isCompleted = enrollment?.status === "COMPLETED";
            const frameworks  = (course.complianceFrameworks ?? []) as string[];

            return (
              <div key={course.id} className="card flex flex-col hover:border-accent/30 transition-colors">
                <div className="p-5 flex-1">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-accent/10 flex-shrink-0">
                      <BookOpen className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {course.isMandatory && (
                        <Badge variant="destructive" className="text-xs">Mandatory</Badge>
                      )}
                      {isCompleted && (
                        <Badge variant="success" className="text-xs flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Done
                        </Badge>
                      )}
                    </div>
                  </div>

                  <h3 className="font-heading font-semibold text-text-primary text-sm leading-snug mb-1.5">
                    {course.title}
                  </h3>
                  <p className="text-xs text-text-muted line-clamp-2 mb-3">{course.description}</p>

                  {/* Compliance framework tags */}
                  {frameworks.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {frameworks.slice(0, 3).map((fw) => (
                        <span key={fw} className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border border-border text-text-muted bg-elevated">
                          {FRAMEWORK_LABELS[fw] ?? fw}
                        </span>
                      ))}
                      {frameworks.length > 3 && (
                        <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border border-border text-text-muted bg-elevated">
                          +{frameworks.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 pb-5">
                  {/* Progress bar if enrolled */}
                  {isEnrolled && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-text-muted mb-1">
                        <span>Progress</span>
                        <span>{enrollment.progressPct}%</span>
                      </div>
                      <div className="h-1 bg-border rounded-full">
                        <div
                          className={cn("h-1 rounded-full", isCompleted ? "bg-success" : "bg-accent")}
                          style={{ width: `${enrollment.progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" />{course.estimatedMin} min
                      <span className="mx-1 text-border">·</span>
                      {course._count.modules} module{course._count.modules !== 1 ? "s" : ""}
                    </span>
                    {isEnrolled ? (
                      <Link
                        href={`/employee/courses/${course.id}`}
                        className="text-xs font-medium text-accent hover:underline flex items-center gap-0.5"
                      >
                        {isCompleted ? "Review" : enrollment?.status === "IN_PROGRESS" ? "Continue" : "Start"}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <span className="text-xs text-text-muted">Not assigned</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
