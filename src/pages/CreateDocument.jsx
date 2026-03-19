import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Plus, Trash2, AlertCircle, Upload, Loader2, CheckCircle, Merge, Split } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/components/LanguageContext";
import PageHeader from "../components/PageHeader";
import InsufficientPointsDialog from "../components/InsufficientPointsDialog";
import PointsCostConfirmDialog from "../components/PointsCostConfirmDialog";

const detectLanguage = (text) => {
  const hebrewPattern = /[\u0590-\u05FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  
  if (hebrewPattern.test(text)) return 'he';
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
};

export default function CreateDocument() {
  const { t, isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('groupId');
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [creationMode, setCreationMode] = useState("manual");
  const [showInsufficientPointsDialog, setShowInsufficientPointsDialog] = useState(false);
  const [showPointsConfirm, setShowPointsConfirm] = useState(false);
  const [pendingDocData, setPendingDocData] = useState(null);
  const [pointsCheckCompleted, setPointsCheckCompleted] = useState(false);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const { data: existingDocuments } = useQuery({
    queryKey: ['allDocuments'],
    queryFn: () => base44.entities.Document.list(),
    initialData: [],
  });

  // Check if user is group admin for the target group
  const { data: isGroupAdmin } = useQuery({
    queryKey: ['isGroupAdmin', groupId, user?.id],
    queryFn: async () => {
      if (!groupId || !user?.id) return false;
      const members = await base44.entities.GroupMember.filter({ groupId, userId: user.id });
      return members.length > 0 && members[0].role === 'admin';
    },
    enabled: !!groupId && !!user?.id,
    initialData: false,
  });

  const [formData, setFormData] = useState({
    title: "",
    urlName: "",
    privacy: "public_view_open_participation",
    votingButtonsEnabled: true,
    defaultSuggestionLifetimeHours: 72,
    groupId: groupId || null,
  });

  const [topics, setTopics] = useState([{ title: "", sections: [{ content: "" }] }]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedStructure, setExtractedStructure] = useState(null);
  const [processingStage, setProcessingStage] = useState("");

  useEffect(() => {
    if (!userLoading && !user) {
      base44.auth.redirectToLogin(window.location.pathname);
    }
  }, [user, userLoading]);

  // Update formData when groupId from URL changes
  useEffect(() => {
    if (groupId) {
      setFormData(prev => ({
        ...prev,
        groupId: groupId
      }));
    }
  }, [groupId]);

  // Check points requirement before allowing document creation
  useEffect(() => {
    if (!user || userLoading) return;

    // If admin - skip points check
    if (user.role === 'admin') {
      setPointsCheckCompleted(true);
      return;
    }

    // Check if user already confirmed in this session
    const sessionConfirmed = sessionStorage.getItem('consenz_document_points_confirmed');
    if (sessionConfirmed === 'true') {
      setPointsCheckCompleted(true);
      return;
    }

    // Check points
    const currentPoints = user.points || 1000;
    if (currentPoints < 1001) {
      setShowInsufficientPointsDialog(true);
      setPointsCheckCompleted(false);
    } else {
      // Has enough points - show confirmation
      setShowPointsConfirm(true);
      setPointsCheckCompleted(false);
    }
  }, [user, userLoading]);

  const validateUrlName = (urlName) => {
    if (!urlName || urlName.trim() === "") {
      return "URL name is required";
    }
    if (!/^[a-z0-9-]+$/.test(urlName)) {
      return "URL name can only contain lowercase letters, numbers, and hyphens";
    }
    const exists = existingDocuments.some(doc => doc.urlName === urlName);
    if (exists) {
      return "This URL name is already taken. Please choose another.";
    }
    return null;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!validTypes.includes(file.type)) {
      setError("Please upload a PDF or Word document (.pdf, .doc, .docx)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    setUploadedFile(file);
    setError(null);
    setIsProcessing(true);
    setProcessingStage("מעלה קובץ...");

    try {
      console.log("[PDF Upload] Starting file upload...", file.name, file.size);
      const startTime = Date.now();
      
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      console.log("[PDF Upload] File uploaded in", Date.now() - startTime, "ms:", file_url);
      
      setProcessingStage("מנתח את מבנה המסמך (עד 2 דקות)...");
      console.log("[PDF Upload] Starting LLM analysis...");
      const llmStartTime = Date.now();

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract document structure into topics and sections.

RULES:
1. Find all headings/chapters - each becomes a TOPIC
2. Split content into SHORT sections - each paragraph = 1 section  
3. Keep sections under 200 words each
4. Preserve original text exactly
5. Use exact heading text for topic titles

Return JSON with title, topics array (each with title and sections array with content).`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            topics: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  sections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        content: { type: "string" }
                      },
                      required: ["content"]
                    }
                  }
                },
                required: ["title", "sections"]
              }
            }
          },
          required: ["title", "topics"]
        }
      });
      
      console.log("[PDF Upload] LLM completed in", Date.now() - llmStartTime, "ms");
      console.log("[PDF Upload] Result:", JSON.stringify(result).substring(0, 500));

      setProcessingStage("מאמת נתונים...");

      if (!result || !result.topics || !Array.isArray(result.topics)) {
        console.error("[PDF Upload] Invalid result:", result);
        throw new Error("לא הצלחנו לחלץ מבנה תקין מהמסמך");
      }
      
      console.log("[PDF Upload] Found", result.topics.length, "raw topics");

      const validTopics = result.topics.filter(topic => {
        const isValid = topic.title &&
               topic.sections &&
               Array.isArray(topic.sections) &&
               topic.sections.length > 0 &&
               topic.sections.some(section => section.content && section.content.trim().length > 0);
        if (!isValid) {
          console.log("[PDF Upload] Filtered out invalid topic:", topic.title);
        }
        return isValid;
      });

      if (validTopics.length === 0) {
        console.error("[PDF Upload] No valid topics after filtering");
        throw new Error("לא נמצאו נושאים תקינים במסמך. נסה יצירה ידנית.");
      }

      const cleanTopics = validTopics.map(topic => ({
        title: topic.title.trim(),
        sections: topic.sections
          .filter(section => section.content && section.content.trim().length > 0)
          .map(section => ({
            content: section.content.trim()
          }))
      }));

      const totalSections = cleanTopics.reduce((sum, t) => sum + t.sections.length, 0);
      console.log("[PDF Upload] Final structure:", cleanTopics.length, "topics,", totalSections, "sections");

      setExtractedStructure({ ...result, topics: cleanTopics });

      const suggestedTitle = result.title?.trim() || file.name.replace(/\.[^/.]+$/, "");
      const suggestedUrlName = suggestedTitle
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .substring(0, 50);

      setFormData({
        ...formData,
        title: suggestedTitle,
        urlName: suggestedUrlName,
      });

      setTopics(cleanTopics);
      setProcessingStage("הושלם!");

    } catch (err) {
      console.error("[PDF Upload] ERROR:", err);
      console.error("[PDF Upload] Error stack:", err.stack);
      setError(err.message || "שגיאה בעיבוד המסמך. נסה יצירה ידנית או קובץ אחר.");
      setUploadedFile(null);
      setExtractedStructure(null);
    } finally {
      console.log("[PDF Upload] Process finished");
      setIsProcessing(false);
      setTimeout(() => setProcessingStage(""), 2000);
    }
  };

  const createDocMutation = useMutation({
    mutationFn: async (data) => {
      const urlError = validateUrlName(data.urlName);
      if (urlError) {
        throw new Error(urlError);
      }

      const validTopics = data.topics.filter(t =>
        t.title && t.title.trim() &&
        t.sections && t.sections.length > 0 &&
        t.sections.some(s => s.content && s.content.trim())
      );

      if (validTopics.length === 0) {
        throw new Error("Please add at least one topic with one section");
      }

      // Check if user exists and is admin - admins don't pay for document creation
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }
      
      const isAdmin = user.role === 'admin';
      
      if (!isAdmin) {
        // Check if user has enough points (1001 required to create document)
        const currentPoints = user.points || 1000;
        if (currentPoints < 1001) {
          throw new Error('INSUFFICIENT_POINTS');
        }

        // Deduct 1001 points from user
        await base44.auth.updateMe({
          points: currentPoints - 1001
        });

        // Create points transaction record
        await base44.entities.PointsTransaction.create({
          userId: user.id,
          amount: -1001,
          action: 'suggestion_created',
          description: `יצירת מסמך חדש: ${data.title}`,
          relatedEntityType: 'document'
        });
      }
      
      // NOTE: Public profile already ensured by Layout on mount - no need to check here

      const doc = await base44.entities.Document.create({
        title: data.title.trim(),
        urlName: data.urlName.trim(),
        privacy: data.privacy,
        votingButtonsEnabled: data.votingButtonsEnabled,
        defaultSuggestionLifetimeHours: data.defaultSuggestionLifetimeHours,
        avgSuggestionConsensus: 0.5,
        totalUsersInteracted: 0,
        threshold: 0,
        originalLanguage: language,
        groupId: data.groupId || null,
      });

      await base44.entities.DocumentAdmin.create({
        documentId: doc.id,
        userId: user.id,
      });

      for (let i = 0; i < validTopics.length; i++) {
        const topicData = validTopics[i];

        const topicTitle = topicData.title.trim();
        const topicLanguage = detectLanguage(topicTitle);
        
        const topic = await base44.entities.Topic.create({
          documentId: doc.id,
          title: topicTitle,
          order: i,
          originalLanguage: topicLanguage,
        });

        const validSections = topicData.sections.filter(s => s.content && s.content.trim());

        for (let j = 0; j < validSections.length; j++) {
          const sectionContent = validSections[j].content.trim();
          const sectionLanguage = detectLanguage(sectionContent);

          const newSection = await base44.entities.Section.create({
            documentId: doc.id,
            topicId: topic.id,
            content: sectionContent,
            order: j,
            lastEditedBy: user.id,
            originalLanguage: sectionLanguage,
          });

          // שמירת גרסה ראשונית של הסעיף
          await base44.entities.DocumentVersion.create({
            documentId: doc.id,
            sectionId: newSection.id,
            content: sectionContent,
            changeDescription: 'גרסה ראשונית',
            version: 0,
            changeType: 'section_created',
          });
        }
      }

      return doc;
    },
    onSuccess: async (doc) => {
      console.log('[CREATE DOC] Document created:', doc.id);
      
      // Pre-cache the document in React Query
      queryClient.setQueryData(['document', doc.id], doc);
      
      // Invalidate queries and wait for them to settle
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['publicDocuments'] }),
        queryClient.invalidateQueries({ queryKey: ['allDocuments'] }),
        queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      ]);
      
      console.log('[CREATE DOC] Queries invalidated, navigating to document');
      
      // Small delay to ensure all data is ready before navigation
      setTimeout(() => {
        navigate(`${createPageUrl("DocumentView")}?id=${doc.id}`);
      }, 300);
    },
    onError: (err) => {
      console.error("Document creation error:", err);
      if (err.message === 'INSUFFICIENT_POINTS') {
        setShowInsufficientPointsDialog(true);
      } else {
        setError(err.message || "Failed to create document. Please try again.");
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.title || !formData.title.trim()) {
      setError("Document title is required");
      return;
    }

    if (formData.title.trim().length < 3) {
      setError("Title must be at least 3 characters long");
      return;
    }

    const urlError = validateUrlName(formData.urlName);
    if (urlError) {
      setError(urlError);
      return;
    }

    const validTopics = topics.filter(t =>
      t.title && t.title.trim() &&
      t.sections && t.sections.length > 0 &&
      t.sections.some(s => s.content && s.content.trim())
    );

    if (validTopics.length === 0) {
      setError("Please add at least one topic with one section containing content");
      return;
    }

    // Check if should show points confirmation dialog (skip for admins)
    const isAdmin = user?.role === 'admin';
    const skipConfirm = localStorage.getItem('consenz_skip_points_confirm_document') === 'true';
    const currentPoints = user?.points || 1000;
    
    if (!isAdmin && !skipConfirm && currentPoints >= 1001) {
      setPendingDocData({ ...formData, topics: validTopics });
      setShowPointsConfirm(true);
      return;
    }

    createDocMutation.mutate({ ...formData, topics: validTopics });
  };

  const handleConfirmPoints = () => {
    if (pendingDocData) {
      createDocMutation.mutate(pendingDocData);
      setPendingDocData(null);
    }
  };

  const handleInitialPointsConfirm = () => {
    sessionStorage.setItem('consenz_document_points_confirmed', 'true');
    setPointsCheckCompleted(true);
    setShowPointsConfirm(false);
  };

  const handleInsufficientPointsClose = () => {
    setShowInsufficientPointsDialog(false);
    navigate(createPageUrl("Home"));
  };

  const addTopic = () => {
    setTopics([...topics, { title: "", sections: [{ content: "" }] }]);
  };

  const removeTopic = (index) => {
    if (topics.length === 1) {
      setError("Document must have at least one topic");
      return;
    }
    setTopics(topics.filter((_, i) => i !== index));
  };

  const addSection = (topicIndex) => {
    const newTopics = [...topics];
    newTopics[topicIndex].sections.push({ content: "" });
    setTopics(newTopics);
  };

  const removeSection = (topicIndex, sectionIndex) => {
    const newTopics = [...topics];
    if (newTopics[topicIndex].sections.length === 1) {
      setError("Each topic must have at least one section");
      return;
    }
    newTopics[topicIndex].sections = newTopics[topicIndex].sections.filter((_, i) => i !== sectionIndex);
    setTopics(newTopics);
  };

  const mergeSections = (topicIndex, sectionIndex) => {
    if (sectionIndex === 0) return; // Can't merge with previous if first
    const newTopics = [...topics];
    const currentSection = newTopics[topicIndex].sections[sectionIndex];
    const previousSection = newTopics[topicIndex].sections[sectionIndex - 1];
    
    // Merge current into previous
    newTopics[topicIndex].sections[sectionIndex - 1].content = 
      previousSection.content + '\n\n' + currentSection.content;
    
    // Remove current section
    newTopics[topicIndex].sections.splice(sectionIndex, 1);
    setTopics(newTopics);
  };

  const splitSection = (topicIndex, sectionIndex) => {
    const newTopics = [...topics];
    const section = newTopics[topicIndex].sections[sectionIndex];
    const content = section.content.trim();
    
    if (!content) return;
    
    // Find midpoint (by newlines or half of content)
    const lines = content.split('\n');
    const midpoint = Math.ceil(lines.length / 2);
    
    const firstHalf = lines.slice(0, midpoint).join('\n');
    const secondHalf = lines.slice(midpoint).join('\n');
    
    // Update current section with first half
    newTopics[topicIndex].sections[sectionIndex].content = firstHalf;
    
    // Insert new section with second half
    newTopics[topicIndex].sections.splice(sectionIndex + 1, 0, { content: secondHalf });
    setTopics(newTopics);
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setExtractedStructure(null);
    setTopics([{ title: "", sections: [{ content: "" }] }]);
    setFormData({
      ...formData,
      title: "",
      urlName: "",
    });
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <InsufficientPointsDialog
        isOpen={showInsufficientPointsDialog}
        onClose={handleInsufficientPointsClose}
        requiredPoints={1001}
        currentPoints={user?.points || 1000}
        actionType="document"
      />

      <PointsCostConfirmDialog
        isOpen={showPointsConfirm && !pendingDocData}
        onClose={() => {
          if (pendingDocData) {
            // This is the final confirmation before creation
            setShowPointsConfirm(false);
            setPendingDocData(null);
          } else {
            // This is the initial confirmation - go back to home
            setShowPointsConfirm(false);
            navigate(createPageUrl("Home"));
          }
        }}
        onConfirm={pendingDocData ? handleConfirmPoints : handleInitialPointsConfirm}
        cost={1001}
        currentPoints={user?.points || 1000}
        actionType="document"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader 
          title={t('createNewDocument')}
        />
        
        {!pointsCheckCompleted && (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}
        
        {pointsCheckCompleted && (
          <>
        <p className={`text-slate-600 ${isRTL ? 'text-right' : ''}`}>{t('fillDetailsBelow')}</p>

        {user && user.role !== 'admin' && (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-blue-900">
              <strong>עלות יצירת מסמך:</strong> 1001 נקודות | <strong>הנקודות שלך:</strong> {user.points || 1000}
            </AlertDescription>
          </Alert>
        )}
        
        {user && user.role === 'admin' && (
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription className="text-green-900">
              <strong>מצב אדמין:</strong> אין עלות ליצירת מסמכים עבור משתמשי Admin
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={creationMode} onValueChange={(val) => {
          setCreationMode(val);
          setError(null);
        }} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">
              <FileText className="w-4 h-4 mr-2" />
              Manual Creation
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-6">
            <Card className="border-2 border-dashed border-slate-300 bg-white">
              <CardHeader>
                <CardTitle>Upload & Sync Document</CardTitle>
                <CardDescription>
                  Upload a PDF or Word document. AI will automatically extract topics and sections.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!uploadedFile && !isProcessing && (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                      <Upload className="w-10 h-10 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Upload Your Document</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      We'll analyze it and extract the structure automatically
                    </p>
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Button type="button" asChild className="bg-gradient-to-r from-blue-600 to-indigo-600">
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          Choose File
                        </span>
                      </Button>
                      <input
                        id="file-upload"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-slate-500 mt-4">
                      Supported: PDF, DOC, DOCX • Max size: 10MB
                    </p>
                  </div>
                )}

                {isProcessing && (
                  <div className="text-center py-12">
                    <Loader2 className="w-16 h-16 mx-auto mb-4 text-blue-600 animate-spin" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      מעבד את המסמך
                    </h3>
                    <p className="text-slate-600">{processingStage}</p>
                    <p className="text-sm text-slate-400 mt-2">ניתוח PDF עשוי לקחת עד 2 דקות</p>
                    <div className="mt-4 max-w-md mx-auto">
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
                      </div>
                    </div>
                  </div>
                )}

                {uploadedFile && !isProcessing && extractedStructure && (
                  <div className="space-y-4">
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        <strong>Success!</strong> Found {extractedStructure.topics.length} topics with{' '}
                        {extractedStructure.topics.reduce((sum, t) => sum + t.sections.length, 0)} sections.
                        Review and edit below.
                      </AlertDescription>
                    </Alert>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{uploadedFile.name}</p>
                          <p className="text-sm text-slate-500">
                            {(uploadedFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={resetUpload}
                        size="sm"
                      >
                        Upload Different File
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {(creationMode === "manual" || extractedStructure) && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Document Details</CardTitle>
                <CardDescription>Basic information about your document</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Document Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Community Constitution"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="urlName">URL Name *</Label>
                  <Input
                    id="urlName"
                    value={formData.urlName}
                    onChange={(e) => {
                      const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
                      setFormData({ ...formData, urlName: cleaned });
                    }}
                    placeholder="e.g., community-constitution"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Used in URL • Only lowercase letters, numbers, and hyphens
                  </p>
                  {formData.urlName && validateUrlName(formData.urlName) && (
                    <p className="text-xs text-red-600 mt-1">{validateUrlName(formData.urlName)}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="privacy">Privacy Setting</Label>
                  <Select
                    value={formData.privacy}
                    onValueChange={(value) => setFormData({ ...formData, privacy: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public_view_open_participation">
                        🌐 Public - Open Participation
                      </SelectItem>
                      <SelectItem value="public_view_closed_participation">
                        👀 Public View - Closed Participation
                      </SelectItem>
                      <SelectItem value="private_invite_only">
                        🔒 Private - Invite Only
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label htmlFor="voting" className="text-base">Enable Voting Buttons</Label>
                    <p className="text-sm text-slate-500">Allow users to vote on suggestions</p>
                  </div>
                  <Switch
                    id="voting"
                    checked={formData.votingButtonsEnabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, votingButtonsEnabled: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader>
                <div>
                  <CardTitle>Topics & Sections</CardTitle>
                  <CardDescription>
                    {extractedStructure
                      ? "Review and edit the extracted structure"
                      : "Structure your document with topics and sections"}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {topics.map((topic, topicIndex) => (
                  <div key={topicIndex} className="border-2 border-slate-200 rounded-lg p-4 space-y-4 bg-slate-50">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500 mb-1">Topic {topicIndex + 1}</Label>
                        <Input
                          value={topic.title}
                          onChange={(e) => {
                            const newTopics = [...topics];
                            newTopics[topicIndex].title = e.target.value;
                            setTopics(newTopics);
                          }}
                          placeholder="Enter topic title..."
                          className="bg-white"
                        />
                      </div>
                      {topics.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTopic(topicIndex)}
                          className="mt-6"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {topic.sections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="border border-slate-200 rounded-lg p-3 bg-white">
                          <div className="flex gap-2 items-start mb-2">
                            <div className="flex-1">
                              <Label className="text-xs text-slate-500 mb-1">
                                Section {sectionIndex + 1}
                              </Label>
                              <Textarea
                                value={section.content}
                                onChange={(e) => {
                                  const newTopics = [...topics];
                                  newTopics[topicIndex].sections[sectionIndex].content = e.target.value;
                                  setTopics(newTopics);
                                }}
                                placeholder="Enter section content..."
                                className="bg-white"
                                rows={4}
                              />
                            </div>
                            {topic.sections.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeSection(topicIndex, sectionIndex)}
                                className="mt-6"
                                title="Delete section"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                          <div className="flex gap-2 justify-end">
                            {sectionIndex > 0 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => mergeSections(topicIndex, sectionIndex)}
                                title="Merge with previous section"
                              >
                                <Merge className="w-3 h-3 mr-1" />
                                Merge Up
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => splitSection(topicIndex, sectionIndex)}
                              title="Split section in half"
                            >
                              <Split className="w-3 h-3 mr-1" />
                              Split
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      onClick={() => addSection(topicIndex)}
                      variant="outline"
                      size="sm"
                      className="ml-4"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Section to "{topic.title || 'this topic'}"
                    </Button>
                  </div>
                ))}

                <Button type="button" onClick={addTopic} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Topic
                </Button>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(createPageUrl("Home"))}
                disabled={createDocMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createDocMutation.isPending || !formData.title || !formData.urlName}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                {createDocMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Create Document
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
        </>
        )}
        </div>
      </div>
    </>
  );
}