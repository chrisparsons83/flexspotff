import { loader } from "./podcast";

describe("Podcasts Loader", () => {
  it("should return a response", async () => {
    const responseData = await loader({
      request: new Request("http://localhost:3000/podcasts"),
      params: {},
      context: {},
    }).then(response => response.json());

    expect(responseData).toBeInstanceOf(Object);
    expect(responseData.json.episodes).toBeInstanceOf(Array);
  });
});

describe("Podcasts loader returns episode data", () => {
  it("should return a response", async () => {
    const responseData = await loader({
      // contents of loaderArgs (request, params, context) not actually used
      request: new Request("http://localhost:3000/podcast"),
      params: {},
      context: {},
    }).then(response => response.json());

    responseData.json.episodes.forEach((episode: Object) => {
      expect(episode).toHaveProperty("id");
      expect(episode).toHaveProperty("createdAt");
      expect(episode).toHaveProperty("updatedAt");
      expect(episode).toHaveProperty("authorId");
      expect(episode).toHaveProperty("description");
      expect(episode).toHaveProperty("duration");
      expect(episode).toHaveProperty("episode");
      expect(episode).toHaveProperty("filepath");
      expect(episode).toHaveProperty("filesize");
      expect(episode).toHaveProperty("filetype");
      expect(episode).toHaveProperty("publishDate");
      expect(episode).toHaveProperty("season");
      expect(episode).toHaveProperty("shownotes");
      expect(episode).toHaveProperty("title");
    })
  });
});