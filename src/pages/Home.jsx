import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, TrendingUp, Users, Clock, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/components/LanguageContext";

export default function Home() {
  const { t } = useLanguage();
  const { data: documents, isLoading } = useQuery({
    queryKey: ['publicDocuments'],
    queryFn: () => base44.entities.Document.list('-created_date', 20),
    initialData: [],
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-purple-600/10" />
        <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-32">
          <div className="text-center space-y-6">
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-4 py-1">
              Democratic Collaboration Platform
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 leading-tight">
              Build Consensus,
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Draft Together
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
              Collaborative platform for drafting policy documents, constitutions, and decisions
              through transparent voting and dynamic consensus algorithms.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              {user ? (
                <Link to={createPageUrl("CreateDocument")}>
                  <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                    Create Document
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              ) : (
                <Button
                  size="lg"
                  onClick={() => base44.auth.redirectToLogin()}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
              <Button size="lg" variant="outline">
                Learn More
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
              <CardContent className="p-6 text-center">
                <FileText className="w-8 h-8 mx-auto mb-3 text-blue-600" />
                <div className="text-3xl font-bold text-slate-900">{documents.length}</div>
                <div className="text-sm text-slate-600">Active Documents</div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
              <CardContent className="p-6 text-center">
                <Users className="w-8 h-8 mx-auto mb-3 text-indigo-600" />
                <div className="text-3xl font-bold text-slate-900">
                  {documents.reduce((sum, d) => sum + (d.totalUsersInteracted || 0), 0)}
                </div>
                <div className="text-sm text-slate-600">Collaborators</div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
              <CardContent className="p-6 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-3 text-purple-600" />
                <div className="text-3xl font-bold text-slate-900">
                  {(documents.reduce((sum, d) => sum + (d.avgSuggestionConsensus || 0), 0) / (documents.length || 1) * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-slate-600">Avg Consensus</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Recent Documents */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Recent Documents</h2>
            <p className="text-slate-600 mt-2">Browse and contribute to ongoing collaborative drafts</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-white border-slate-200">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <Card className="bg-white border-slate-200">
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Documents Yet</h3>
              <p className="text-slate-600 mb-4">Be the first to create a collaborative document</p>
              {user && (
                <Link to={createPageUrl("CreateDocument")}>
                  <Button>Create Document</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <Link key={doc.id} to={`${createPageUrl("DocumentView")}?id=${doc.id}`}>
                <Card className="bg-white border-slate-200 hover:shadow-lg hover:border-blue-300 transition-all duration-200 cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{doc.title}</CardTitle>
                      <Badge variant="outline" className={
                        doc.privacy === 'public_view_open_participation' 
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }>
                        {doc.privacy === 'public_view_open_participation' ? 'Open' : 'Closed'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Users className="w-4 h-4" />
                        <span>{doc.totalUsersInteracted || 0} contributors</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <TrendingUp className="w-4 h-4" />
                        <span>{((doc.avgSuggestionConsensus || 0) * 100).toFixed(0)}% consensus</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Clock className="w-4 h-4" />
                        <span>{new Date(doc.created_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}